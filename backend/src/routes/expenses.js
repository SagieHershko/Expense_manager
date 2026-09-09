const express = require('express');
const { db } = require('../db/database');
const { logger } = require('../middleware/logger');

const router = express.Router();

// GET /api/expenses — קבלת כל ההוצאות של המשתמש המחובר
// תומך בפילטרים: ?category_id=1&month=2024-01
router.get('/', (req, res) => {
  try {
    const { category_id, month } = req.query;
    let query = `
      SELECT e.*, c.name AS category_name
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = ?
    `;
    const params = [req.user.id];

    if (category_id) {
      query += ' AND e.category_id = ?';
      params.push(category_id);
    }
    // month בפורמט YYYY-MM
    if (month) {
      query += " AND strftime('%Y-%m', e.date) = ?";
      params.push(month);
    }

    query += ' ORDER BY e.date DESC';

    const expenses = db.prepare(query).all(...params);
    res.json(expenses);
  } catch (err) {
    logger.error(`Get expenses error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET /api/expenses/export — ייצוא הוצאות לקובץ CSV
// CSV = Comma-Separated Values — פורמט טבלאי פשוט שנפתח ב-Excel
router.get('/export', (req, res) => {
  try {
    const { month, category_id } = req.query;

    let query = `
      SELECT e.date, e.title, e.amount, c.name AS category_name, e.note
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = ?
    `;
    const params = [req.user.id];

    if (category_id) {
      query += ' AND e.category_id = ?';
      params.push(category_id);
    }
    if (month) {
      query += " AND strftime('%Y-%m', e.date) = ?";
      params.push(month);
    }

    query += ' ORDER BY e.date DESC';

    const expenses = db.prepare(query).all(...params);

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
router.post('/', (req, res) => {
  const { title, amount, category_id, date, note } = req.body;

  if (!title || !amount || !date) {
    return res.status(400).json({ error: 'Title, amount and date are required' });
  }
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO expenses (title, amount, category_id, user_id, date, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, amount, category_id || null, req.user.id, date, note || null);

    logger.info(`Expense added: "${title}" (${amount}) by user ${req.user.username}`);
    res.status(201).json({ message: 'Expense created', id: result.lastInsertRowid });
  } catch (err) {
    logger.error(`Add expense error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PUT /api/expenses/:id — עדכון הוצאה קיימת
router.put('/:id', (req, res) => {
  const { title, amount, category_id, date, note } = req.body;
  const { id } = req.params;

  if (!title || !amount || !date) {
    return res.status(400).json({ error: 'Title, amount and date are required' });
  }

  try {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    db.prepare(`
      UPDATE expenses SET title=?, amount=?, category_id=?, date=?, note=?
      WHERE id=? AND user_id=?
    `).run(title, amount, category_id || null, date, note || null, id, req.user.id);

    logger.info(`Expense ${id} updated by user ${req.user.username}`);
    res.json({ message: 'Expense updated' });
  } catch (err) {
    logger.error(`Update expense error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /api/expenses/:id — מחיקת הוצאה
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);

    if (result.changes === 0) {
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
