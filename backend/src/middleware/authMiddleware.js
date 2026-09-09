const jwt = require('jsonwebtoken');
const { logger } = require('./logger');

// Middleware לאימות JWT — רץ לפני כל route מוגן
function authenticate(req, res, next) {
  // ה-token מגיע ב-Header: Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn(`Unauthorized access attempt to ${req.url}`);
    return res.status(401).json({ error: 'Access denied — no token provided' });
  }

  try {
    // מפענחים את ה-token עם ה-secret שלנו
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // שומרים את פרטי המשתמש ב-request כדי שה-route יוכל להשתמש בהם
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn(`Invalid token: ${err.message}`);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
