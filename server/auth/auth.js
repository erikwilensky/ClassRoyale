import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "classroyale-secret-key-change-in-production";
const JWT_EXPIRY = 86400; // 1 day in seconds
const BCRYPT_ROUNDS = 12;

/**
 * Validate NIST email (case-insensitive)
 */
export function validateNISTEmail(email) {
    if (!email || typeof email !== "string") {
        return false;
    }
    const normalizedEmail = email.toLowerCase().trim();
    return normalizedEmail.endsWith("@nist.ac.th");
}

/**
 * Normalize email to lowercase
 */
export function normalizeEmail(email) {
    return email.toLowerCase().trim();
}

/**
 * Validate displayName
 */
export function validateDisplayName(displayName) {
    if (!displayName || typeof displayName !== "string") {
        return false;
    }
    
    const trimmed = displayName.trim();
    
    // Minimum length
    if (trimmed.length < 2) {
        return false;
    }
    
    // Cannot be email address (contains @)
    if (trimmed.includes("@")) {
        return false;
    }
    
    // Cannot be "Admin", "Teacher", "admin", "teacher" (case-insensitive)
    const lower = trimmed.toLowerCase();
    if (lower === "admin" || lower === "teacher") {
        return false;
    }
    
    return true;
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password) {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(playerId, isTeacher = false) {
    return jwt.sign(
        { playerId, isTeacher },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        return null;
    }
}

/**
 * Generate verification token (UUID)
 */
export function generateVerificationToken() {
    return randomUUID();
}



