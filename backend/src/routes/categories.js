const express = require('express');
const { query } = require('../db/database');
const { logger } = require('../middleware/logger');

const router = express.Router();

// GET /api/categories — קבלת קטגוריות של המשתמש
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, icon, monthly_budget, user_id FROM categories WHERE user_id = $1 ORDER BY name',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    logger.error(`Get categories error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/categories — הוספת קטגוריה חדשה (כולל icon ו-monthly_budget)
router.post('/', async (req, res) => {
  const { name, icon, monthly_budget } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const result = await query(
      'INSERT INTO categories (name, user_id, icon, monthly_budget) VALUES ($1, $2, $3, $4) RETURNING id',
      [name.trim(), req.user.id, icon || '🏷️', monthly_budget || null]
    );
    logger.info(`Category "${name}" created by user ${req.user.username}`);
    res.status(201).json({ message: 'Category created', id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Category already exists' });
    }
    logger.error(`Create category error: ${err.message}`);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id — עדכון קטגוריה (icon, monthly_budget, name)
router.put('/:id', async (req, res) => {
  const { name, icon, monthly_budget } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required' });
  }
  try {
    const result = await query(
      'UPDATE categories SET name = $1, icon = $2, monthly_budget = $3 WHERE id = $4 AND user_id = $5',
      [name.trim(), icon || '🏷️', monthly_budget || null, req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    logger.info(`Category ${req.params.id} updated by user ${req.user.username}`);
    res.json({ message: 'Category updated' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    logger.error(`Update category error: ${err.message}`);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id — מחיקת קטגוריה
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
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
