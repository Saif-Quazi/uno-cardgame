function setupHttpServer(app, roomManager) {
  app.post("/api/rooms", (req, res) => {
    try {
      const { maxPlayers = 4 } = req.body;

      if (typeof maxPlayers !== "number" || maxPlayers < 2 || maxPlayers > 4) {
        return res.status(400).json({
          error: "maxPlayers must be a number between 2 and 4",
        });
      }

      const room = roomManager.createRoom(maxPlayers);
      res.json({ code: room.code });
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ error: "Failed to create room" });
    }
  });

  app.get("/api/rooms/:code", (req, res) => {
    const code = String(req.params.code || "")
      .replace(/-/g, "")
      .trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Invalid room code format" });
    }

    const room = roomManager.getRoom(code);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({
      code: room.code,
      players: room.players.length,
      maxPlayers: room.maxPlayers,
      gameStarted: room.gameStarted,
    });
  });

  app.get("/api/stats", (req, res) => {
    res.json(roomManager.getStats());
  });

  console.log("HTTP routes initialized");
}

module.exports = setupHttpServer;
