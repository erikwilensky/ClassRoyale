import express from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { QuizRoom } from "./QuizRoom.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const gameServer = new Server({
    server: server,
});

gameServer.define("quiz_room", QuizRoom);

app.use(express.static(path.join(__dirname, "../client")));

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Open http://localhost:${port}/teacher.html for teacher client`);
    console.log(`Open http://localhost:${port}/student.html for student client`);
});

