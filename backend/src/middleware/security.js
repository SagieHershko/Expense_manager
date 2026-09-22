/**
 * Security Middleware
 *
 * שכבת אבטחה נוספת לשרת:
 * 1. Security Headers — כותרות HTTP שמגנות מפני התקפות נפוצות
 * 2. Rate Limiting — מגביל מספר בקשות כדי למנוע spam/DDoS
 */

// Rate Limiting — מגביל כמה בקשות כל IP יכול לשלוח בדקה
// מונע brute force (ניסיונות סיסמה חוזרים) ו-spam
const rateLimitMap = new Map();

function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, { count: 1, start: now });
      return next();
    }

    const record = rateLimitMap.get(ip);

    // אם עברה יותר מדקה — איפוס הספירה
    if (now - record.start > windowMs) {
      rateLimitMap.set(ip, { count: 1, start: now });
      return next();
    }

    record.count++;

    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests — please try again later'
      });
    }

    next();
  };
}

// Security Headers — כותרות שמגנות מפני XSS, Clickjacking ועוד
function securityHeaders(req, res, next) {
  // מונע הצגת האתר ב-iframe (הגנה מפני Clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');

  // מונע דפדפן מלנחש את סוג התוכן (הגנה מפני MIME sniffing)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // מפעיל הגנת XSS מובנית בדפדפן
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // מסתיר מידע על השרת
  res.removeHeader('X-Powered-By');

  next();
}

module.exports = { rateLimit, securityHeaders };
