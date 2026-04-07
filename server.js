const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const RoomManager = require("./server/roomManager");
const setupRoutes = require("./server/http");
const setupSocketHandlers = require("./server/socket");

const PORT = process.env.PORT || 8080;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const roomManager = new RoomManager();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

setupRoutes(app, roomManager);

setupSocketHandlers(io, roomManager);

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║      UNO Multiplayer Server          ║
╠══════════════════════════════════════╣
║  Server running on port ${PORT}         ║
║  http://localhost:${PORT}               ║
╚══════════════════════════════════════╝
  `);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
