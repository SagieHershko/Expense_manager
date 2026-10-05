const { Pool } = require('pg');

// ב-production וב-development מתחברים ל-Postgres (Neon / Docker) דרך DATABASE_URL.
// בבדיקות (NODE_ENV=test) בלי DATABASE_URL משתמשים ב-PGlite — Postgres אמיתי בתוך התהליך, בזיכרון.
let driver;

function getDriver() {
  if (driver) return driver;

  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: process.env.VERCEL ? 5 : 10
    });
    driver = {
      async query(text, params) {
        const res = await pool.query(text, params);
        return { rows: res.rows, rowCount: res.rowCount };
      },
      exec: (sql) => pool.query(sql)
    };
  } else if (process.env.NODE_ENV === 'test') {
    const { PGlite } = require('@electric-sql/pglite');
    const pg = new PGlite();
    driver = {
      async query(text, params) {
        const res = await pg.query(text, params);
        return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
      },
      exec: (sql) => pg.exec(sql)
    };
  } else {
    throw new Error('DATABASE_URL is not set — point it at a Postgres database (e.g. Neon)');
  }
  return driver;
}

// query(text, params) → { rows, rowCount }. placeholders בפורמט $1, $2, ...
function query(text, params = []) {
  return getDriver().query(text, params);
}

// מחרוזת אחת עם כמה פקודות רצה כטרנזקציה אחת; ה-advisory lock מונע race בין cold starts מקבילים
const SCHEMA = `
  SELECT pg_advisory_xact_lock(727274);

  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
  );

  CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    icon TEXT DEFAULT '🏷️',
    monthly_budget DOUBLE PRECISION DEFAULT NULL,
    UNIQUE (name, user_id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date);

  CREATE TABLE IF NOT EXISTS shared_groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
  );

  -- status: 'pending' = ממתין לאישור המוזמן, 'accepted' = חבר פעיל
  CREATE TABLE IF NOT EXISTS group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES shared_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    joined_at TEXT DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
    UNIQUE (group_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
`;

let ready;

// idempotent — קריאות חוזרות מחזירות את אותו promise
function initDB() {
  if (!ready) {
    ready = Promise.resolve()
      .then(() => getDriver().exec(SCHEMA))
      .catch((err) => {
        ready = undefined;
        throw err;
      });
  }
  return ready;
}

module.exports = { query, initDB };
