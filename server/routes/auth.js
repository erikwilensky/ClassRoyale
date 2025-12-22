import express from "express";
import { db } from "../db/database.js";
import {
    validateNISTEmail,
    normalizeEmail,
    validateDisplayName,
    hashPassword,
    verifyPassword,
    generateToken,
    generateVerificationToken
} from "../auth/auth.js";
import { authenticateToken } from "../middleware/auth.js";
import { getPlayerUnlockedCards } from "../services/xpService.js";
import { randomUUID } from "crypto";

const router = express.Router();

/**
 * POST /api/register
 * Register a new player account
 */
router.post("/register", async (req, res) => {
    try {
        const { email, displayName, password, isTeacher = false } = req.body;

        // Validate input
        if (!email || !displayName || !password) {
            return res.status(400).json({ error: "Email, displayName, and password are required" });
        }

        // Validate NIST email
        if (!validateNISTEmail(email)) {
            return res.status(400).json({ error: "Email must be a valid @nist.ac.th address" });
        }

        // Normalize email
        const normalizedEmail = normalizeEmail(email);

        // Prevent student emails (starting with numbers) from registering as teachers
        if (isTeacher) {
            const emailPrefix = normalizedEmail.split("@")[0];
            // Check if email starts with a number (student emails typically start with numbers)
            if (/^\d/.test(emailPrefix)) {
                return res.status(400).json({ error: "Student emails cannot register as teachers. Please use a teacher email address." });
            }
        }

        // Validate displayName
        if (!validateDisplayName(displayName)) {
            return res.status(400).json({ 
                error: "Display name cannot be an email, 'Admin', 'Teacher', or less than 2 characters" 
            });
        }

        // Check if email already exists
        const existing = db.prepare("SELECT id FROM players WHERE email = ?").get(normalizedEmail);
        if (existing) {
            return res.status(409).json({ error: "Email already registered" });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Generate verification token
        const verificationToken = generateVerificationToken();

        // Create player
        const playerId = randomUUID();
        db.prepare(`
            INSERT INTO players (id, email, displayName, passwordHash, verificationToken, isTeacher)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(playerId, normalizedEmail, displayName.trim(), passwordHash, verificationToken, isTeacher ? 1 : 0);

        // Console log verification link (for local dev)
        const verifyLink = `http://localhost:3000/api/verify?token=${verificationToken}`;
        console.log(`\n📧 Verification link for ${normalizedEmail}:`);
        console.log(`   ${verifyLink}\n`);

        res.status(201).json({
            message: "Account created. Please verify your email using the link below.",
            verificationUrl: verifyLink,
            verificationToken: verificationToken,
            email: normalizedEmail
        });
    } catch (error) {
        console.error("[Register Error]:", error);
        res.status(500).json({ error: "Registration failed" });
    }
});

/**
 * GET /api/verify?token=...
 * Verify email address
 */
router.get("/verify", (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: "Verification token required" });
        }

        // Find player by verification token
        const player = db.prepare(
            "SELECT id, email, verified FROM players WHERE verificationToken = ?"
        ).get(token);

        if (!player) {
            return res.redirect(`http://localhost:5173/verified?status=error&message=${encodeURIComponent("Invalid verification token")}`);
        }

        if (player.verified) {
            // Already verified, redirect to client-side verified page
            return res.redirect(`http://localhost:5173/verified?status=success&email=${encodeURIComponent(player.email)}`);
        }

        // Mark as verified and clear token
        db.prepare(`
            UPDATE players 
            SET verified = 1, verificationToken = NULL 
            WHERE id = ?
        `).run(player.id);

        // Redirect to client-side verified page
        res.redirect(`http://localhost:5173/verified?status=success&email=${encodeURIComponent(player.email)}`);
    } catch (error) {
        console.error("[Verify Error]:", error);
        res.status(500).json({ error: "Verification failed" });
    }
});

/**
 * POST /api/login
 * Login and get JWT token
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const normalizedEmail = normalizeEmail(email);

        // Find player
        const player = db.prepare(
            "SELECT id, email, displayName, passwordHash, verified, xp, level, isTeacher FROM players WHERE email = ?"
        ).get(normalizedEmail);

        if (!player) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Check if verified
        if (!player.verified) {
            return res.status(403).json({ error: "Account not verified. Please check your email." });
        }

        // Verify password
        const passwordValid = await verifyPassword(password, player.passwordHash);
        if (!passwordValid) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Generate JWT token
        const token = generateToken(player.id, Boolean(player.isTeacher));

        // Get unlocked cards
        const unlockedCards = getPlayerUnlockedCards(player.id);

        res.json({
            token,
            player: {
                id: player.id,
                email: player.email,
                displayName: player.displayName,
                xp: player.xp,
                level: player.level,
                isTeacher: Boolean(player.isTeacher),
                unlockedCards
            }
        });
    } catch (error) {
        console.error("[Login Error]:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

/**
 * GET /api/profile
 * Get player profile (protected)
 */
router.get("/profile", authenticateToken, (req, res) => {
    try {
        const player = db.prepare(
            "SELECT id, email, displayName, xp, level, isTeacher FROM players WHERE id = ?"
        ).get(req.playerId);

        if (!player) {
            return res.status(404).json({ error: "Player not found" });
        }

        // Get unlocked cards (same query logic as QuizRoom)
        const unlockedCards = getPlayerUnlockedCards(req.playerId);

        res.json({
            id: player.id,
            email: player.email,
            displayName: player.displayName,
            xp: player.xp,
            level: player.level,
            isTeacher: Boolean(player.isTeacher),
            unlockedCards
        });
    } catch (error) {
        console.error("[Profile Error]:", error);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

/**
 * GET /api/unlocks
 * Get unlocked cards (protected)
 */
router.get("/unlocks", authenticateToken, (req, res) => {
    try {
        // Use same query logic as /api/profile and QuizRoom
        const unlockedCards = getPlayerUnlockedCards(req.playerId);
        res.json({ unlockedCards });
    } catch (error) {
        console.error("[Unlocks Error]:", error);
        res.status(500).json({ error: "Failed to fetch unlocks" });
    }
});

export default router;

