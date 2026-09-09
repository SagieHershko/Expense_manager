const Database = require('better-sqlite3');
const path = require('path');

// יוצרים את הDB בתיקיית backend — אם לא קיים, ייווצר אוטומטית
const DB_PATH = path.join(__dirname, '../../expense.db');

const db = new Database(DB_PATH);

// WAL mode — מאפשר קריאה וכתיבה במקביל (ביצועים טובים יותר)
db.pragma('journal_mode = WAL');

function initDB() {
  // טבלת משתמשים
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // טבלת קטגוריות
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(name, user_id)
    )
  `);

  // טבלת הוצאות
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id INTEGER,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);
}

module.exports = { db, initDB };
