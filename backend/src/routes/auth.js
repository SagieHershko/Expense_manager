const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/database');
const { logger } = require('../middleware/logger');

const router = express.Router();

// POST /api/auth/register — הרשמת משתמש חדש
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // bcrypt — מצפין את הסיסמה לפני שמירה ב-DB (אף פעם לא שומרים plain text!)
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = await query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );

    logger.info(`New user registered: ${username}`);
    res.status(201).json({ message: 'User created successfully', userId: result.rows[0].id });
  } catch (err) {
    // unique_violation — username כבר קיים
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    logger.error(`Register error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login — התחברות
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = (await query('SELECT * FROM users WHERE username = $1', [username])).rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      logger.warn(`Failed login attempt for username: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // יוצרים JWT token שתקף ל-7 ימים
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info(`User logged in: ${username}`);
    res.json({ token, username: user.username });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
