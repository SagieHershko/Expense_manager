const express = require('express');
const { db } = require('../db/database');
const { logger } = require('../middleware/logger');

const router = express.Router();

// ─────────────────────────────────────────────────────
// POST /api/groups
// יצירת קבוצה משותפת חדשה.
// המשתמש שיוצר את הקבוצה נכנס אוטומטית כחבר פעיל (accepted).
// ─────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Group name is required' });
  }

  try {
    // יצירת הקבוצה
    const group = db.prepare(
      'INSERT INTO shared_groups (name, owner_id) VALUES (?, ?)'
    ).run(name.trim(), req.user.id);

    // היוצר נכנס לקבוצה כחבר פעיל מיידית — אין צורך שיאשר הזמנה לעצמו
    db.prepare(
      'INSERT INTO group_members (group_id, user_id, status) VALUES (?, ?, ?)'
    ).run(group.lastInsertRowid, req.user.id, 'accepted');

    logger.info(`Group "${name.trim()}" created by ${req.user.username}`);
    res.status(201).json({ message: 'Group created', id: group.lastInsertRowid });

  } catch (err) {
    logger.error(`Create group error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/groups
// מחזיר את כל הקבוצות שהמשתמש המחובר חבר בהן (בכל סטטוס).
// כולל pending — כדי שיוכל לראות הזמנות שממתינות לאישורו.
// ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const groups = db.prepare(`
      SELECT
        g.id,
        g.name,
        g.owner_id,
        g.created_at,
        gm.status,
        (
          SELECT COUNT(*)
          FROM group_members
          WHERE group_id = g.id AND status = 'accepted'
        ) AS member_count
      FROM shared_groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
      ORDER BY g.created_at DESC
    `).all(req.user.id);

    res.json(groups);
  } catch (err) {
    logger.error(`Get groups error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/groups/:id/invite
// הזמנת משתמש אחר לפי username.
// רק חבר פעיל בקבוצה יכול להזמין.
// ─────────────────────────────────────────────────────
router.post('/:id/invite', (req, res) => {
  const { username } = req.body;
  const groupId = req.params.id;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // בדיקה שהמשתמש המזמין הוא חבר פעיל בקבוצה
    const membership = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND status = ?'
    ).get(groupId, req.user.id, 'accepted');

    if (!membership) {
      return res.status(403).json({ error: 'You are not an active member of this group' });
    }

    // איתור המשתמש המוזמן לפי username
    const invitee = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username.trim());
    if (!invitee) {
      return res.status(404).json({ error: `User "${username}" not found` });
    }

    // מניעת הזמנה עצמית
    if (invitee.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot invite yourself' });
    }

    // INSERT OR IGNORE — אם כבר קיים (pending או accepted), לא תיווצר שגיאה
    const result = db.prepare(
      'INSERT OR IGNORE INTO group_members (group_id, user_id, status) VALUES (?, ?, ?)'
    ).run(groupId, invitee.id, 'pending');

    if (result.changes === 0) {
      return res.status(409).json({ error: `${username} is already in this group or was already invited` });
    }

    logger.info(`${req.user.username} invited ${username} to group ${groupId}`);
    res.json({ message: `Invitation sent to ${username}` });

  } catch (err) {
    logger.error(`Invite error: ${err.message}`);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/groups/:id/invite/accept
// המשתמש המחובר מאשר את ההזמנה שקיבל לקבוצה.
// ─────────────────────────────────────────────────────
router.post('/:id/invite/accept', (req, res) => {
  const groupId = req.params.id;

  try {
    const result = db.prepare(
      'UPDATE group_members SET status = ? WHERE group_id = ? AND user_id = ? AND status = ?'
    ).run('accepted', groupId, req.user.id, 'pending');

    if (result.changes === 0) {
      return res.status(404).json({ error: 'No pending invitation found for this group' });
    }

    logger.info(`${req.user.username} accepted invitation to group ${groupId}`);
    res.json({ message: 'You joined the group!' });

  } catch (err) {
    logger.error(`Accept invite error: ${err.message}`);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/groups/:id/expenses
// מחזיר את כל ההוצאות של כל החברים הפעילים בקבוצה.
// תומך בפילטרים: ?month=2024-01&category_id=3
// מחזיר גם summary — סיכום סכום לפי משתמש (שימושי לממשק).
// ─────────────────────────────────────────────────────
router.get('/:id/expenses', (req, res) => {
  const groupId = req.params.id;
  const { month, category_id } = req.query;

  try {
    // וידוא שהמשתמש המחובר הוא חבר פעיל — מניעת גישה לא מורשית
    const membership = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND status = ?'
    ).get(groupId, req.user.id, 'accepted');

    if (!membership) {
      return res.status(403).json({ error: 'Access denied: you are not an active member of this group' });
    }

    // שליפת הוצאות של כל החברים הפעילים בקבוצה
    let query = `
      SELECT
        e.*,
        c.name   AS category_name,
        u.username AS owner_username
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      JOIN users u ON e.user_id = u.id
      WHERE e.user_id IN (
        SELECT user_id
        FROM group_members
        WHERE group_id = ? AND status = 'accepted'
      )
    `;
    const params = [groupId];

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

    // חישוב סיכום סכום הוצאות לפי משתמש — עבור הצגה בממשק
    const summary = expenses.reduce((acc, e) => {
      acc[e.owner_username] = (acc[e.owner_username] || 0) + e.amount;
      return acc;
    }, {});

    res.json({ expenses, summary });

  } catch (err) {
    logger.error(`Group expenses error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch group expenses' });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/groups/:id/expenses/export
// ייצוא הוצאות קבוצה לקובץ CSV.
// עמודות: תאריך, משתמש, כותרת, סכום, קטגוריה, הערה.
// תומך בפילטרים: ?month=2024-01&category_id=3
// ─────────────────────────────────────────────────────
router.get('/:id/expenses/export', (req, res) => {
  const groupId = req.params.id;
  const { month, category_id } = req.query;

  try {
    // וידוא חברות פעילה
    const membership = db.prepare(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND status = ?'
    ).get(groupId, req.user.id, 'accepted');

    if (!membership) {
      return res.status(403).json({ error: 'Access denied: you are not an active member of this group' });
    }

    // שם הקבוצה (לשם הקובץ)
    const group = db.prepare('SELECT name FROM shared_groups WHERE id = ?').get(groupId);

    let query = `
      SELECT e.date, e.title, e.amount, c.name AS category_name, u.username AS owner_username, e.note
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      JOIN users u ON e.user_id = u.id
      WHERE e.user_id IN (
        SELECT user_id FROM group_members WHERE group_id = ? AND status = 'accepted'
      )
    `;
    const params = [groupId];

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

    // בניית CSV — עם עמודת משתמש נוספת לעומת הייצוא האישי
    const csvRows = [
      'Date,User,Title,Amount,Category,Note',
      ...expenses.map(e => [
        e.date,
        `"${(e.owner_username || '').replace(/"/g, '""')}"`,
        `"${(e.title || '').replace(/"/g, '""')}"`,
        e.amount.toFixed(2),
        `"${(e.category_name || '').replace(/"/g, '""')}"`,
        `"${(e.note || '').replace(/"/g, '""')}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const safeName = (group?.name || 'group').replace(/[^a-zA-Z0-9_]/g, '_');
    const filename = `shared_${safeName}_${month || 'all'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    logger.info(`Shared CSV export by ${req.user.username} for group ${groupId}: ${expenses.length} rows`);
    res.send('﻿' + csvContent); // BOM לתמיכה בעברית ב-Excel

  } catch (err) {
    logger.error(`Shared CSV export error: ${err.message}`);
    res.status(500).json({ error: 'Failed to export shared expenses' });
  }
});

module.exports = router;
