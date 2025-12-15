import sqlite3 from 'sqlite3';

export async function setupDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('./src/db/user.db', (err) => {
      if (err) {
        return reject(err);
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          mustChangePassword INTEGER DEFAULT 0
        );
      `, (err) => {
        if (err) {
          return reject(err);
        }
        resolve(db);
      });
    });
  });
}