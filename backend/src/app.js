require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db/database');
const { requestLogger, logger } = require('./middleware/logger');
const { rateLimit, securityHeaders } = require('./middleware/security');
const { authenticate } = require('./middleware/authMiddleware');

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const categoryRoutes = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());                    // מאפשר בקשות מה-frontend (פורט אחר)
app.use(express.json());
app.use(securityHeaders);        // כותרות אבטחה לכל תגובה
app.use(rateLimit(100, 60000));  // מקסימום 100 בקשות לדקה לכל IP            // מפרסר JSON מגוף הבקשה
app.use(requestLogger);             // מדפיס כל בקשה ל-log

// --- Routes ציבוריים (ללא התחברות) ---
app.use('/api/auth', authRoutes);

// נדרש בדרישות הקורס — endpoint לבדיקת integration test
app.get('/api/hello-world', (req, res) => {
  logger.info('Hello world endpoint called');
  res.json({ message: 'Hello, World!', status: 'ok' });
});

// --- Routes מוגנים (דורשים JWT) ---
app.use('/api/expenses', authenticate, expenseRoutes);
app.use('/api/categories', authenticate, categoryRoutes);

// --- Global error handler ---
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Something went wrong' });
});

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.url} not found` });
});

// --- Start server ---
// מאפשרים export לצורך בדיקות (supertest) מבלי להפעיל listen
if (require.main === module) {
  initDB();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
} else {
  initDB();
}

module.exports = app;
