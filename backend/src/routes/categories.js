const express = require('express');
const { db } = require('../db/database');
const { logger } = require('../middleware/logger');

const router = express.Router();

// GET /api/categories — קבלת קטגוריות של המשתמש
router.get('/', (req, res) => {
  try {
    const categories = db.prepare(
      'SELECT id, name, icon, monthly_budget, user_id FROM categories WHERE user_id = ? ORDER BY name'
    ).all(req.user.id);
    res.json(categories);
  } catch (err) {
    logger.error(`Get categories error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/categories — הוספת קטגוריה חדשה (כולל icon ו-monthly_budget)
router.post('/', (req, res) => {
  const { name, icon, monthly_budget } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const result = db.prepare(
      'INSERT INTO categories (name, user_id, icon, monthly_budget) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), req.user.id, icon || '🏷️', monthly_budget || null);
    logger.info(`Category "${name}" created by user ${req.user.username}`);
    res.status(201).json({ message: 'Category created', id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category already exists' });
    }
    logger.error(`Create category error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id — עדכון קטגוריה (icon, monthly_budget, name)
router.put('/:id', (req, res) => {
  const { name, icon, monthly_budget } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required' });
  }
  try {
    const result = db.prepare(
      'UPDATE categories SET name = ?, icon = ?, monthly_budget = ? WHERE id = ? AND user_id = ?'
    ).run(name.trim(), icon || '🏷️', monthly_budget || null, req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    logger.info(`Category ${req.params.id} updated by user ${req.user.username}`);
    res.json({ message: 'Category updated' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    logger.error(`Update category error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id — מחיקת קטגוריה
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare(
      'DELETE FROM categories WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    logger.info(`Category ${req.params.id} deleted by user ${req.user.username}`);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    logger.error(`Delete category error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
