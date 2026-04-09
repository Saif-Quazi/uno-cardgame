function setupSocketHandlers(io, roomManager) {
  function sanitizeName(name) {
    const sanitized = String(name || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .trim();

    if (sanitized.length < 2 || sanitized.length > 15) {
      return null;
    }

    return sanitized;
  }

  function getPublicRoom(room) {
    return roomManager.getPublicRoom(room);
  }

  io.on("connection", (socket) => {
    socket.on("player:join", ({ playerId, name }) => {
      if (!playerId) {
        socket.emit("room:error", { message: "playerId is required" });
        return;
      }

      socket.playerId = playerId;
      socket.playerName = name || "Player";

      socket.emit("player:joined", { playerId });
    });

    socket.on("room:join", ({ code, playerId, name }) => {
      const normalizedCode = String(code || "")
        .replace(/-/g, "")
        .trim();

      if (!normalizedCode || !playerId) {
        socket.emit("room:error", {
          message: "code and playerId are required",
        });
        return;
      }

      if (!/^\d{6}$/.test(normalizedCode)) {
        socket.emit("room:error", {
          message: "Invalid room code format. Use a 6-digit code.",
        });
        return;
      }

      const room = roomManager.getRoom(normalizedCode);
      if (!room) {
        socket.emit("room:error", {
          message: "Room not found. Please check the room code.",
        });
        return;
      }

      const existingRoom = roomManager.findPlayerRoom(playerId);
      if (existingRoom && existingRoom.code !== normalizedCode) {
        const switchResult = roomManager.removePlayer(
          existingRoom.code,
          playerId,
          false,
        );
        if (switchResult.success) {
          socket.leave(existingRoom.code);

          socket.to(existingRoom.code).emit("player:left", {
            playerId,
            players: switchResult.room.players,
          });

          if (switchResult.wasAdmin && switchResult.newAdmin) {
            io.to(existingRoom.code).emit("admin:changed", {
              newAdminId: switchResult.newAdmin.id,
              newAdminName: switchResult.newAdmin.name,
            });
          }
        }
      }

      const result = roomManager.addPlayer(
        normalizedCode,
        playerId,
        name || "Player",
      );

      if (!result.success) {
        socket.emit("room:error", { message: result.error });
        return;
      }

      if (socket.currentRoom && socket.currentRoom !== normalizedCode) {
        socket.leave(socket.currentRoom);
      }

      socket.join(normalizedCode);
      socket.currentRoom = normalizedCode;
      socket.playerId = playerId;
      socket.playerName = name || "Player";

      if (result.reconnected && result.room.gameStarted) {
        const gameState = roomManager.getPublicGameState(result.room);
        const playerHand = result.room.gameState?.playerHands?.[playerId] || [];

        socket.emit("room:joined", {
          code: result.room.code,
          room: getPublicRoom(result.room),
          gameState,
          hand: playerHand,
          reconnected: true,
        });

        socket.to(normalizedCode).emit("player:reconnected", {
          playerId,
          name: name || "Player",
          players: result.room.players,
        });
      } else {
        socket.emit("room:joined", {
          code: result.room.code,
          room: getPublicRoom(result.room),
          reconnected: result.reconnected || false,
        });

        if (!result.reconnected) {
          socket.to(normalizedCode).emit("player:joined", {
            playerId,
            name: name || "Player",
            players: result.room.players,
          });
        }
      }
    });

    socket.on("player:updateName", ({ name }) => {
      if (!socket.playerId || !socket.currentRoom) {
        socket.emit("room:error", {
          message: "You must be in a room to update your name",
        });
        return;
      }

      const sanitizedName = sanitizeName(name);
      if (!sanitizedName) {
        socket.emit("room:error", {
          message: "Name must be 2-15 alphanumeric characters",
        });
        return;
      }

      const room = roomManager.getRoom(socket.currentRoom);
      if (!room) {
        socket.emit("room:error", { message: "Room not found" });
        return;
      }

      const player = room.players.find(
        (p) => p.id === socket.playerId || p.playerId === socket.playerId,
      );

      if (!player) {
        socket.emit("room:error", { message: "Player not found in room" });
        return;
      }

      player.name = sanitizedName;
      socket.playerName = sanitizedName;
      room.lastActivity = Date.now();

      io.to(socket.currentRoom).emit("player:updated", {
        playerId: socket.playerId,
        name: sanitizedName,
        players: room.players,
      });
    });

    socket.on("room:leave", ({ code, playerId }) => {
      const normalizedCode = String(code || "")
        .replace(/-/g, "")
        .trim();
      if (!normalizedCode || !playerId) return;

      const result = roomManager.removePlayer(normalizedCode, playerId, false);

      if (result.success) {
        socket.leave(normalizedCode);
        socket.currentRoom = null;

        socket.emit("room:left", { code: normalizedCode });

        socket.to(normalizedCode).emit("player:left", {
          playerId,
          players: result.room.players,
        });

        if (result.wasAdmin && result.newAdmin) {
          io.to(normalizedCode).emit("admin:changed", {
            newAdminId: result.newAdmin.id,
            newAdminName: result.newAdmin.name,
          });
        }
      }
    });

    socket.on("game:start", () => {
      if (!socket.currentRoom || !socket.playerId) return;

      const result = roomManager.startGame(socket.currentRoom, socket.playerId);

      if (!result.success) {
        socket.emit("room:error", { message: result.error });
        return;
      }

      const room = roomManager.getRoom(socket.currentRoom);
      room.players.forEach((player) => {
        const playerId = player.id || player.playerId;
        const playerSocket = Array.from(io.sockets.sockets.values()).find(
          (s) => s.playerId === playerId,
        );

        if (playerSocket) {
          playerSocket.emit("game:started", {
            gameState: result.gameState,
            hand: room.gameState.playerHands[playerId],
          });
        }
      });
    });

    socket.on("game:playCard", ({ cardIndex, chosenColor }) => {
      if (
        !socket.currentRoom ||
        !socket.playerId ||
        typeof cardIndex !== "number"
      )
        return;

      const result = roomManager.playCard(
        socket.currentRoom,
        socket.playerId,
        cardIndex,
        chosenColor,
      );

      if (!result.success) {
        socket.emit("room:error", { message: result.error });
        return;
      }

      if (result.winner) {
        const room = roomManager.getRoom(socket.currentRoom);
        if (room) {
          room.players.forEach((player) => {
            const playerId = player.id || player.playerId;
            const playerSocket = Array.from(io.sockets.sockets.values()).find(
              (s) => s.playerId === playerId,
            );

            if (playerSocket) {
              playerSocket.emit("game:stateUpdate", {
                gameState: result.gameState,
                hand: room.gameState.playerHands[playerId],
              });
            }
          });
        }

        io.to(socket.currentRoom).emit("game:winner", {
          winnerId: result.winner,
          gameState: result.gameState,
        });
        return;
      }

      const room = roomManager.getRoom(socket.currentRoom);
      room.players.forEach((player) => {
        const playerId = player.id || player.playerId;
        const playerSocket = Array.from(io.sockets.sockets.values()).find(
          (s) => s.playerId === playerId,
        );

        if (playerSocket) {
          playerSocket.emit("game:stateUpdate", {
            gameState: result.gameState,
            hand: room.gameState.playerHands[playerId],
          });
        }
      });
    });

    socket.on("game:drawCard", () => {
      if (!socket.currentRoom || !socket.playerId) return;

      const result = roomManager.drawCard(socket.currentRoom, socket.playerId);

      if (!result.success) {
        socket.emit("room:error", { message: result.error });
        return;
      }

      const room = roomManager.getRoom(socket.currentRoom);
      room.players.forEach((player) => {
        const playerId = player.id || player.playerId;
        const playerSocket = Array.from(io.sockets.sockets.values()).find(
          (s) => s.playerId === playerId,
        );

        if (playerSocket) {
          playerSocket.emit("game:stateUpdate", {
            gameState: result.gameState,
            hand: room.gameState.playerHands[playerId],
          });
        }
      });
    });

    socket.on("player:kick", ({ playerId: kickPlayerId }) => {
      if (!socket.currentRoom || !socket.playerId) return;

      const room = roomManager.getRoom(socket.currentRoom);
      if (!room) return;

      const adminId = room.players[0]?.id || room.players[0]?.playerId;
      if (adminId !== socket.playerId) {
        socket.emit("room:error", { message: "Only admin can kick players" });
        return;
      }

      if (kickPlayerId === socket.playerId) {
        socket.emit("room:error", { message: "Cannot kick yourself" });
        return;
      }

      if (room.gameStarted) {
        socket.emit("room:error", { message: "Cannot kick during game" });
        return;
      }

      const playerToKick = room.players.find(
        (p) => p.id === kickPlayerId || p.playerId === kickPlayerId,
      );
      if (!playerToKick) {
        socket.emit("room:error", { message: "Player not found in room" });
        return;
      }

      const adminName = socket.playerName || "Admin";
      const result = roomManager.removePlayer(
        socket.currentRoom,
        kickPlayerId,
        true,
      );

      if (result.success) {
        const kickedSocket = Array.from(io.sockets.sockets.values()).find(
          (s) => s.playerId === kickPlayerId,
        );

        if (kickedSocket) {
          kickedSocket.emit("player:kicked", {
            kickedBy: adminName,
            message: `You have been kicked by ${adminName}`,
          });
          kickedSocket.leave(socket.currentRoom);
          kickedSocket.currentRoom = null;
        }

        io.to(socket.currentRoom).emit("player:left", {
          playerId: kickPlayerId,
          players: result.room.players,
        });
      } else {
        socket.emit("room:error", { message: result.error });
      }
    });

    socket.on("disconnect", () => {
      if (socket.playerId && socket.currentRoom) {
        const room = roomManager.getRoom(socket.currentRoom);

        const wasAdmin =
          room &&
          room.players[0] &&
          (room.players[0].id === socket.playerId ||
            room.players[0].playerId === socket.playerId);

        roomManager.disconnectPlayer(socket.playerId);

        if (room) {
          socket.to(socket.currentRoom).emit("player:disconnected", {
            playerId: socket.playerId,
            players: room.players,
          });

          if (wasAdmin) {
            const connectedPlayers = room.players.filter((p) => p.connected);
            if (connectedPlayers.length > 0) {
              const newAdmin = connectedPlayers[0];
              const newAdminId = newAdmin.id || newAdmin.playerId;
              const newAdminIndex = room.players.findIndex(
                (p) => (p.id || p.playerId) === newAdminId,
              );

              if (newAdminIndex > 0) {
                const promotedAdmin = room.players.splice(newAdminIndex, 1)[0];
                room.players.unshift(promotedAdmin);
              }

              socket.to(socket.currentRoom).emit("admin:changed", {
                newAdminId,
                newAdminName: newAdmin.name,
              });
            }
          }
        }
      }
    });
  });
}

module.exports = setupSocketHandlers;
