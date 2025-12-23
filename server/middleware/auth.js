import { verifyToken } from "../auth/auth.js";

/**
 * JWT authentication middleware
 * Attaches req.playerId and req.isTeacher to request
 */
export function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }

    req.playerId = decoded.playerId;
    req.isTeacher = decoded.isTeacher || false;
    next();
}



