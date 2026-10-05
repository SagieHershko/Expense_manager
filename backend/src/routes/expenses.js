const express = require('express');
const { query } = require('../db/database');
const { logger } = require('../middleware/logger');

const router = express.Router();

// GET /api/expenses — קבלת כל ההוצאות של המשתמש המחובר
// תומך בפילטרים: ?category_id=1&month=2024-01
router.get('/', async (req, res) => {
  try {
    const { category_id, month } = req.query;
    let sql = `
      SELECT e.*, c.name AS category_name
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = $1
    `;
    const params = [req.user.id];

    if (category_id) {
      params.push(category_id);
      sql += ` AND e.category_id = $${params.length}`;
    }
    // month בפורמט YYYY-MM
    if (month) {
      params.push(month);
      sql += ` AND substr(e.date, 1, 7) = $${params.length}`;
    }

    sql += ' ORDER BY e.date DESC';

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    logger.error(`Get expenses error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET /api/expenses/export — ייצוא הוצאות לקובץ CSV
// CSV = Comma-Separated Values — פורמט טבלאי פשוט שנפתח ב-Excel
router.get('/export', async (req, res) => {
  try {
    const { month, category_id } = req.query;

    let sql = `
      SELECT e.date, e.title, e.amount, c.name AS category_name, e.note
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = $1
    `;
    const params = [req.user.id];

    if (category_id) {
      params.push(category_id);
      sql += ` AND e.category_id = $${params.length}`;
    }
    if (month) {
      params.push(month);
      sql += ` AND substr(e.date, 1, 7) = $${params.length}`;
    }

    sql += ' ORDER BY e.date DESC';

    const { rows: expenses } = await query(sql, params);

    // בניית תוכן ה-CSV
    // שורה ראשונה = headers, שורות הבאות = נתונים
    const csvRows = [
      'Date,Title,Amount,Category,Note',   // header row
      ...expenses.map(e => [
        e.date,
        `"${(e.title || '').replace(/"/g, '""')}"`,        // גרשיים כפולים לטיפול בפסיקים
        e.amount.toFixed(2),
        `"${(e.category_name || '').replace(/"/g, '""')}"`,
        `"${(e.note || '').replace(/"/g, '""')}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');

    // שליחת הקובץ כ-download
    const filename = `expenses_${month || 'all'}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    logger.info(`CSV export by user ${req.user.username}: ${expenses.length} rows`);
    res.send('﻿' + csvContent); // BOM לתמיכה בעברית ב-Excel
  } catch (err) {
    logger.error(`CSV export error: ${err.message}`);
    res.status(500).json({ error: 'Failed to export expenses' });
  }
});

// POST /api/expenses — הוספת הוצאה חדשה
router.post('/', async (req, res) => {
  const { title, amount, category_id, date, note } = req.body;

  if (!title || !amount || !date) {
    return res.status(400).json({ error: 'Title, amount and date are required' });
  }
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    const result = await query(
      `INSERT INTO expenses (title, amount, category_id, user_id, date, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [title, amount, category_id || null, req.user.id, date, note || null]
    );

    logger.info(`Expense added: "${title}" (${amount}) by user ${req.user.username}`);
    res.status(201).json({ message: 'Expense created', id: result.rows[0].id });
  } catch (err) {
    logger.error(`Add expense error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PUT /api/expenses/:id — עדכון הוצאה קיימת
router.put('/:id', async (req, res) => {
  const { title, amount, category_id, date, note } = req.body;
  const { id } = req.params;

  if (!title || !amount || !date) {
    return res.status(400).json({ error: 'Title, amount and date are required' });
  }

  try {
    const result = await query(
      `UPDATE expenses SET title = $1, amount = $2, category_id = $3, date = $4, note = $5
       WHERE id = $6 AND user_id = $7`,
      [title, amount, category_id || null, date, note || null, id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    logger.info(`Expense ${id} updated by user ${req.user.username}`);
    res.json({ message: 'Expense updated' });
  } catch (err) {
    logger.error(`Update expense error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /api/expenses/:id — מחיקת הוצאה
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    logger.info(`Expense ${req.params.id} deleted by user ${req.user.username}`);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    logger.error(`Delete expense error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
