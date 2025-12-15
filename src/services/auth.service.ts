import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { setupDatabase } from '../db/user.db';

interface User {
  id: number;
  username: string;
  password?: string;
  role: string;
}

export class AuthService {
  private db: sqlite3.Database;
  private jwtSecret: string;

  constructor() {
    this.db = new sqlite3.Database('./src/db/user.db');
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    this.jwtSecret = process.env.JWT_SECRET;
  }

  async initialize() {
    await setupDatabase();
  }

  async register(username: string, password: string, role: string): Promise<void> {
    if (role !== 'Admin' && role !== 'User') {
      throw new Error('Invalid role');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, hashedPassword, role],
        (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        }
      );
    });
  }

  async login(username: string, password: string): Promise<{ id: number; username: string; role: string; mustChangePassword: boolean } | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, row: any | null) => {
          if (err) {
            return reject(err);
          }
          if (!row) {
            return resolve(null);
          }
          const isMatch = await bcrypt.compare(password, row.password || '');
          if (!isMatch) {
            return resolve(null);
          }
          resolve({ 
            id: row.id, 
            username: row.username, 
            role: row.role,
            mustChangePassword: row.mustChangePassword === 1
          });
        }
      );
    });
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT password FROM users WHERE id = ?',
        [userId],
        async (err, row: any | null) => {
          if (err) return reject(err);
          if (!row) return resolve(false);
          
          const isMatch = await bcrypt.compare(currentPassword, row.password);
          if (!isMatch) return resolve(false);
          
          const hashedPassword = await bcrypt.hash(newPassword, 10);
          this.db.run(
            'UPDATE users SET password = ?, mustChangePassword = 0 WHERE id = ?',
            [hashedPassword, userId],
            (err) => {
              if (err) return reject(err);
              resolve(true);
            }
          );
        }
      );
    });
  }

  generateToken(user: { id: number; username: string; role: string }): string {
    const payload = { sub: user.id, username: user.username, role: user.role };
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '1h' });
  }

  async getUserById(userId: number): Promise<{ id: number; username: string; role: string } | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, username, role FROM users WHERE id = ?',
        [userId],
        (err, row: { id: number; username: string; role: string } | null) => {
          if (err) {
            return reject(err);
          }
          if (!row) {
            return resolve(null);
          }
          resolve(row);
        }
      );
    });
  }

  async getUserRole(userId: number): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT role FROM users WHERE id = ?',
        [userId],
        (err, row: { role: string } | null) => {
          if (err) {
            return reject(err);
          }
          if (!row) {
            return resolve(null);
          }
          resolve(row.role);
        }
      );
    });
  }
}