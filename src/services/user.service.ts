import { Logger } from "@src/logger";
import sqlite3 from "sqlite3";
import bcrypt from "bcrypt";
import { setupDatabase } from "../db/user.db";

interface User {
    id?: number;
    username: string;
    password?: string;
    role?: string;
}

let userDB: sqlite3.Database | null = null;

export const initUsersDB = async (): Promise<void> => {
    Logger.INFO("Initializing Users DB (consolidated)...");
    try {
        userDB = await setupDatabase() as unknown as sqlite3.Database;
        Logger.INFO('Consolidated users DB ready');
    } catch (err) {
        Logger.ERROR(`Failed to initialize consolidated users DB: ${err}`);
        throw err;
    }
};

const ensureDB = () => {
    if (!userDB) throw new Error('Users DB not initialized');
    return userDB;
};

export const getAllUsers = async () => {
    const db = ensureDB();
    return new Promise((resolve, reject) => {
        db.all("SELECT id, username, role FROM users", (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

export const getUserById = async (id: number) => {
    const db = ensureDB();
    return new Promise((resolve, reject) => {
        db.get("SELECT id, username, role FROM users WHERE id = ?", [id], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

export const createUser = async (user: User): Promise<{ id: number; username: string; role: string }> => {
    const db = ensureDB();
    return new Promise(async (resolve, reject) => {
        try {
            const hashed = await bcrypt.hash(user.password || '', 10);
            db.run(
                "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                [user.username, hashed, user.role || 'User'],
                function (err) {
                    if (err) return reject(err);
                    db.get("SELECT id, username, role FROM users WHERE id = ?", [this.lastID], (err, row) => {
                        if (err) return reject(err);
                        resolve(row as { id: number; username: string; role: string });
                    });
                }
            );
        } catch (err) {
            reject(err);
        }
    });
};

export const updateUser = async (id: number, user: User): Promise<{ id: number; username: string; role: string }> => {
    const db = ensureDB();
    return new Promise(async (resolve, reject) => {
        try {
            if (user.password) {
                const hashed = await bcrypt.hash(user.password, 10);
                db.run("UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?", [user.username, hashed, user.role || 'User', id], function (err) {
                    if (err) return reject(err);
                    db.get("SELECT id, username, role FROM users WHERE id = ?", [id], (err, row) => {
                        if (err) return reject(err);
                        resolve(row as { id: number; username: string; role: string });
                    });
                });
            } else {
                db.run("UPDATE users SET username = ?, role = ? WHERE id = ?", [user.username, user.role || 'User', id], function (err) {
                    if (err) return reject(err);
                    db.get("SELECT id, username, role FROM users WHERE id = ?", [id], (err, row) => {
                        if (err) return reject(err);
                        resolve(row as { id: number; username: string; role: string });
                    });
                });
            }
        } catch (err) {
            reject(err);
        }
    });
};

export const deleteUser = async (id: number): Promise<boolean> => {
    const db = ensureDB();
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM users WHERE id = ?", [id], (err) => {
            if (err) return reject(err);
            resolve(true);
        });
    });
};