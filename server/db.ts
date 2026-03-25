import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database;

export async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'morozka.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      username TEXT,
      avatar TEXT,
      is_admin INTEGER DEFAULT 0,
      is_blocked INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      receiver_id INTEGER,
      content TEXT,
      reply_to_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id),
      FOREIGN KEY (reply_to_id) REFERENCES messages(id)
    );
  `);

  try {
    await db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
  } catch (e) {}

  try {
    await db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
  } catch (e) {}

  try {
    await db.exec('ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0');
  } catch (e) {}

  try {
    // Specifically promote "Admin" user to admin status
    await db.run("UPDATE users SET is_admin = 1 WHERE LOWER(username) = 'admin'");
  } catch (e) {}

  try {
    await db.exec('ALTER TABLE messages ADD COLUMN reply_to_id INTEGER');
  } catch (e) {}

  console.log('Database initialized');
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
