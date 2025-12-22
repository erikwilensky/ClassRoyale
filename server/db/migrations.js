import { db } from "./database.js";

export function runMigrations() {
    console.log("Running database migrations...");

    // Create players table
    db.exec(`
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            displayName TEXT NOT NULL,
            passwordHash TEXT NOT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            verified BOOLEAN DEFAULT 0,
            verificationToken TEXT,
            isTeacher BOOLEAN DEFAULT 0
        )
    `);

    // Chapter 10: Add availableXP column to players table (if not exists)
    try {
        db.exec(`ALTER TABLE players ADD COLUMN availableXP INTEGER DEFAULT 0`);
        // For existing players, set availableXP = xp
        db.exec(`UPDATE players SET availableXP = xp WHERE availableXP IS NULL OR availableXP = 0`);
        console.log("✅ Added availableXP column to players table");
    } catch (error) {
        // Column already exists, ignore
        if (!error.message.includes("duplicate column name")) {
            console.warn("Warning adding availableXP column:", error.message);
        }
    }

    // Create unlocks table
    db.exec(`
        CREATE TABLE IF NOT EXISTS unlocks (
            playerId TEXT NOT NULL,
            cardId TEXT NOT NULL,
            unlockedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (playerId, cardId),
            FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE
        )
    `);

    // Chapter 10: Add unlockMethod column to unlocks table (if not exists)
    try {
        db.exec(`ALTER TABLE unlocks ADD COLUMN unlockMethod TEXT DEFAULT 'level'`);
        // For existing unlocks, set unlockMethod = 'level' (legacy)
        db.exec(`UPDATE unlocks SET unlockMethod = 'level' WHERE unlockMethod IS NULL`);
        console.log("✅ Added unlockMethod column to unlocks table");
    } catch (error) {
        // Column already exists, ignore
        if (!error.message.includes("duplicate column name")) {
            console.warn("Warning adding unlockMethod column:", error.message);
        }
    }

    console.log("✅ Database migrations completed");
}


