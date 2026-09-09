const winston = require('winston');

// Winston — ספריית logging מקצועית
// מדפיסה לוגים גם לקונסול וגם לקובץ
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    // לוג לקונסול
    new winston.transports.Console(),
    // לוג לקובץ — כל הלוגים
    new winston.transports.File({ filename: 'logs/app.log' }),
    // לוג לקובץ — רק שגיאות
    new winston.transports.File({ filename: 'logs/errors.log', level: 'error' })
  ]
});

// Middleware — מדפיס כל בקשה HTTP שמגיעה לשרת
function requestLogger(req, res, next) {
  logger.info(`${req.method} ${req.url} — IP: ${req.ip}`);
  next(); // חשוב! מעביר את הבקשה הלאה
}

module.exports = { logger, requestLogger };
