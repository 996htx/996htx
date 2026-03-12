const { createClient } = require('@libsql/client');
const path = require('path');

const client = createClient({
  url: `file:${path.join(__dirname, 'timetrack.db')}`
});

// Convenience helpers — mimic better-sqlite3 API but async
const db = {
  all: (sql, args = []) => client.execute({ sql, args }).then(r => r.rows),
  get: (sql, args = []) => client.execute({ sql, args }).then(r => r.rows[0] || null),
  run: (sql, args = []) => client.execute({ sql, args }).then(r => ({
    lastInsertRowid: Number(r.lastInsertRowid),
    changes: r.rowsAffected
  }))
};

async function initDb() {
  await client.executeMultiple(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      avatar_color TEXT NOT NULL DEFAULT '#4f46e5',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#4f46e5',
      status TEXT NOT NULL DEFAULT 'active',
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER REFERENCES projects(id),
      clock_in DATETIME NOT NULL,
      clock_out DATETIME,
      clock_in_lat REAL,
      clock_in_lng REAL,
      clock_in_address TEXT,
      clock_out_lat REAL,
      clock_out_lng REAL,
      clock_out_address TEXT,
      notes TEXT,
      duration_minutes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER REFERENCES projects(id),
      time_entry_id INTEGER REFERENCES time_entries(id),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      caption TEXT,
      lat REAL,
      lng REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = { db, initDb };
