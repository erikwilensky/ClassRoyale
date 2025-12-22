import express from "express";
import { createServer } from "http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { QuizRoom } from "./QuizRoom.js";
import { LobbyRoom } from "./LobbyRoom.js";
import path from "path";
import { fileURLToPath } from "url";
import { runMigrations } from "./db/migrations.js";
import authRoutes from "./routes/auth.js";
import scoringRoutes, { setQuizRoomInstance } from "./routes/scoring.js";
import shopRoutes, { setShopQuizRoomInstance, playerRouter } from "./routes/shop.js";
import matchCardRulesRoutes, { setMatchCardRulesInstance } from "./routes/matchCardRules.js";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Initialize database
try {
    runMigrations();
    console.log('✅ Database migrations completed');
} catch (error) {
    console.error('❌ Database migration failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
}

// CORS middleware - allow requests from Vite dev server
// Must be before routes
app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", authRoutes);
app.use("/api", scoringRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/player", playerRouter);
app.use("/api/match", matchCardRulesRoutes);

// Static files (React app)
app.use(express.static(path.join(__dirname, "../client")));

// Colyseus game server
const gameServer = new Server({
    transport: new WebSocketTransport({ server }),
});

// Store reference to active room instance (for REST API access)
// Note: This assumes single room instance. For multiple rooms, would need room registry.
let activeRoomInstance = null;

gameServer.define("quiz_room", QuizRoom).on("create", (room) => {
    activeRoomInstance = room;
    setQuizRoomInstance(room);
    setShopQuizRoomInstance(room);
    setMatchCardRulesInstance(room);
    console.log("✅ QuizRoom instance created and registered for REST API");
}).on("dispose", (room) => {
    if (room === activeRoomInstance) {
        activeRoomInstance = null;
        setQuizRoomInstance(null);
        setShopQuizRoomInstance(null);
        console.log("✅ QuizRoom instance disposed");
    }
});

gameServer.define("lobby", LobbyRoom);

const port = process.env.PORT || 3000;

// Error handling for server startup
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

server.listen(port, () => {
    console.log(`✅ Colyseus server is running on port ${port}`);
    console.log(`📱 React client should run on port 5173 (Vite dev server)`);
    console.log(`   Teacher: http://localhost:5173/teacher`);
    console.log(`   Student: http://localhost:5173/student`);
    console.log(`   Login: http://localhost:5173/login`);
    console.log(`   Register: http://localhost:5173/register`);
    console.log(`\n⚠️  Note: The old HTML files (teacher.html, student.html) are deprecated.`);
    console.log(`   Use the React app instead (run 'npm run dev' in the client/ directory).`);
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use. Please stop the other process or use a different port.`);
        console.error(`   Try: netstat -ano | findstr :${port} to find the process using the port.`);
    } else {
        console.error('❌ Server failed to start:', error);
        console.error('Stack:', error.stack);
    }
    process.exit(1);
});

