import { Logger } from "@src/logger";
import sqlite3 from "sqlite3"
import bcrypt from "bcrypt";
import fs from 'fs';
import path from "path";

interface User {
    id: number;
    name: string;
    email: string;
    password: string;
}

const dbDir = path.resolve(__dirname, '../db');
const usersDBPath = path.join(dbDir, 'okuu.db');
let userDB: sqlite3.Database;

const createUsersTable = (): Promise<void | Error> => {
    return new Promise((resolve, reject) => {
        userDB.run(
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            )`,
            (err: any) => {
                if (err) {
                    Logger.ERROR(err);
                    reject(err);
                } else {
                    Logger.INFO("Users table created or already exists.");
                    resolve();
                }
            }
        );
    });
};

export const initUsersDB = async (): Promise<void | Error> => {
    Logger.INFO("Initializing Users DB...");

    if (!fs.existsSync(dbDir)) {
        Logger.INFO("DB directory does not exist. Creating new directory...");
        fs.mkdirSync(dbDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
        userDB = new sqlite3.Database(usersDBPath,
            sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE,
            async (err: any) => {
                if (err) {
                    Logger.ERROR(err);
                    reject(err);
                } else {
                    Logger.INFO("Users DB initialized.");
                    try {
                        await createUsersTable();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }
            });
    });
};

export const getAllUsers = async () => {
    return new Promise((resolve, reject) => {
        userDB.all("SELECT * FROM users", (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export const getUserById = async (id: number) => {
    return new Promise((resolve, reject) => {
        userDB.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

export const createUser = async (user: User): Promise<User> => {
    return new Promise(async (resolve, reject) => {
        try {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            userDB.run(
                "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                [user.name, user.email, hashedPassword],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Fetch the newly inserted user using the last inserted ID
                        return userDB.get(
                            "SELECT * FROM users WHERE id = ?",
                            [this.lastID],
                            (err, row: User) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(row);
                                }
                            }
                        );
                    }
                }
            );
        } catch (error) {
            reject(error);
        }
    });
};

export const updateUser = async (id: number, user: User): Promise<User> => {
    return new Promise((resolve, reject) => {
        userDB.run(
            "UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?",
            [user.name, user.email, user.password, id],
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    return userDB.get(
                        "SELECT * FROM users WHERE id = ?",
                        [id],
                        (err, row: User) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(row);
                            }
                        }
                    );
                }
            }
        );
    });
}

export const deleteUser = async (id: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        userDB.run("DELETE FROM users WHERE id = ?", [id], (err) => {
            if (err) {
                reject(false);
            } else {
                resolve(true);
            }
        });
    });
}