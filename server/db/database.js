import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const dbPath = path.join(__dirname, "../../data/classroyale.db");

// Create database connection
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

console.log(`✅ Database connected: ${dbPath}`);



