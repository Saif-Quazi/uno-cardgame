const Game = (() => {
  "use strict";

  let currentRoom = null;
  let playerId = null;
  let gameState = null;
  let myHand = [];
  let isInitializing = false;

  const UI = typeof UnoUI !== "undefined" ? UnoUI : null;
  const V = typeof Validate !== "undefined" ? Validate : null;
  const Utils = typeof UnoUtils !== "undefined" ? UnoUtils : null;
  const Sock = typeof Socket !== "undefined" ? Socket : null;

  function _log(...args) {
    if (console && console.log) console.log("[GameBootstrap]", ...args);
  }

  async function ensureGameLayout() {
    if (
      document.getElementById("gameBoard") &&
      document.getElementById("roomCode") &&
      document.getElementById("playersList")
    ) {
      return true;
    }

    try {
      const response = await fetch("/game.html", { cache: "no-store" });
      if (!response.ok) return false;

      const html = await response.text();
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const nextMain = parsed.querySelector("main");
      if (!nextMain) return false;

      const currentMain = document.querySelector("main");
      if (currentMain) currentMain.replaceWith(nextMain);
      else document.body.appendChild(nextMain);

      const nextSettingsIcon = parsed.getElementById("settingsIcon");
      const currentSettingsIcon = document.getElementById("settingsIcon");
      if (currentSettingsIcon) currentSettingsIcon.remove();
      if (nextSettingsIcon) {
        document.body.insertBefore(nextSettingsIcon, document.body.firstChild);
      }

      parsed.querySelectorAll("template[id]").forEach((tpl) => {
        const existing = document.getElementById(tpl.id);
        if (existing) existing.replaceWith(tpl);
        else document.body.appendChild(tpl);
      });

      if (!document.querySelector('link[href="styles/game.css"]')) {
        const gameCss = document.createElement("link");
        gameCss.rel = "stylesheet";
        gameCss.href = "styles/game.css";
        document.head.appendChild(gameCss);
      }

      const homeCss = document.querySelector('link[href="styles/home.css"]');
      if (homeCss) homeCss.remove();

      if (parsed.title) document.title = parsed.title;
      return true;
    } catch (error) {
      console.error("Failed to load game layout:", error);
      return false;
    }
  }

  function updateRoomCode(code) {
    const element = document.getElementById("roomCode");
    if (element && Utils && Utils.formatRoomCode) {
      element.textContent = Utils.formatRoomCode(code);
    } else if (element) {
      element.textContent = code || "";
    }
  }

  function updatePlayerCount(currentCount, maxCount) {
    const element = document.querySelector(".player-count");
    if (element) {
      element.textContent = `${currentCount}/${maxCount}`;
    }

    const startBtn = document.getElementById("startGameBtn");
    if (!startBtn || !currentRoom) return;

    const canStart = V
      ? V.canStartGame(currentRoom, playerId, currentCount, maxCount)
      : (currentRoom.players?.[0]?.id || currentRoom.players?.[0]?.playerId) ===
          playerId &&
        currentCount >= 2 &&
        currentCount <= maxCount;

    if (canStart) startBtn.classList.remove("hidden");
    else startBtn.classList.add("hidden");
  }

  function updatePlayerList(players) {
    const listContainer = document.getElementById("playersList");
    if (!listContainer) return;

    const isAdmin = V
      ? V.isAdmin(currentRoom, playerId)
      : currentRoom?.players?.[0]?.id === playerId ||
        currentRoom?.players?.[0]?.playerId === playerId;

    if (UI && typeof UI.renderPlayerList === "function") {
      UI.renderPlayerList(listContainer, players, {
        currentPlayerId: playerId,
        isAdmin,
        room: currentRoom,
        onKick: (pid) => {
          if (!Sock) return;
          Sock.emit("player:kick", { playerId: pid });
        },
      });
    } else {
      listContainer.innerHTML = "";
      players.forEach((p) => {
        const el = document.createElement("div");
        el.className = "playerTile";
        el.textContent = p.name || "Player";
        listContainer.appendChild(el);
      });
    }

    if (currentRoom) {
      updatePlayerCount(players.length, currentRoom.maxPlayers);
    }
  }

  function renderGameBoard(updatedGameState) {
    document.getElementById("roomOptions")?.classList.add("hidden");
    document.getElementById("gameBoard")?.classList.remove("hidden");

    gameState = updatedGameState || gameState;

    if (UI && UI.renderTopCard) {
      UI.renderTopCard(
        document.getElementById("discardPile"),
        gameState.topCard,
      );
    }

    const hand = gameState.playerHands?.[playerId] || myHand || [];
    myHand = hand;
    if (UI && UI.renderHand) {
      UI.renderHand("playerCards", hand, {
        gameState,
        playerId,
        onCardClick: handleCardClick,
      });
    }

    if (UI && UI.renderOpponents) {
      UI.renderOpponents(gameState, playerId);
    }

    updateDrawPileState();
    updateTurnIndicator();
  }

  function handleCardClick(index, card, cardEl) {
    if (!gameState) return;

    if (V && !V.isPlayerTurn(gameState, playerId)) return;
    if (!V && gameState.currentPlayerId !== playerId) return;

    const topCard = gameState.topCard;
    const currentColor = gameState.currentColor;
    const drawCount = gameState.drawCount || 0;

    if (drawCount > 0) {
      const canStack = V
        ? V.canStack(card, topCard)
        : (card.type === "draw2" && topCard.type === "draw2") ||
          (card.type === "wild4" && topCard.type === "wild4");
      if (!canStack) {
        Utils && Utils.showNotification
          ? Utils.showNotification(
              `You must draw ${drawCount} cards first!`,
              "error",
            )
          : alert(`You must draw ${drawCount} cards first!`);
        return;
      }
    }

    const playable = V
      ? V.canPlayCard(card, topCard, currentColor)
      : card.color === "wild" ||
        card.color === currentColor ||
        card.value === topCard.value;
    if (!playable) {
      Utils && Utils.showNotification
        ? Utils.showNotification("That card cannot be played!", "error")
        : alert("That card cannot be played!");
      return;
    }

    if (card.color === "wild") {
      if (UI && UI.showColorPicker) {
        UI.showColorPicker((color) => {
          if (Sock)
            Sock.emit("game:playCard", {
              cardIndex: index,
              chosenColor: color,
            });
        });
      } else {
        if (Sock)
          Sock.emit("game:playCard", { cardIndex: index, chosenColor: "red" });
      }
    } else {
      if (Sock) Sock.emit("game:playCard", { cardIndex: index });
    }
  }

  function handleDrawCard() {
    if (!gameState) return;
    if (
      V
        ? !V.isPlayerTurn(gameState, playerId)
        : gameState.currentPlayerId !== playerId
    )
      return;
    if (Sock) Sock.emit("game:drawCard");
  }

  function updateDrawPileState() {
    const drawPile = document.getElementById("drawPile");
    if (!drawPile || !gameState) return;

    const canDraw = V
      ? V.canDraw(gameState, playerId)
      : gameState.currentPlayerId === playerId &&
        (gameState.drawCount > 0 || !gameState.hasDrawnThisTurn);

    if (canDraw) {
      drawPile.classList.add("active-turn");
      drawPile.classList.remove("inactive-turn");
    } else {
      drawPile.classList.remove("active-turn");
      drawPile.classList.add("inactive-turn");
    }
  }

  function updateTurnIndicator() {
    const indicator = document.getElementById("turnIndicator");
    if (!indicator || !gameState || !currentRoom) return;

    const currentPlayerId = gameState.currentPlayerId;
    if (
      V ? V.isPlayerTurn(gameState, playerId) : currentPlayerId === playerId
    ) {
      indicator.textContent = "Your Turn";
      indicator.classList.add("your-turn");
    } else {
      indicator.classList.remove("your-turn");
      const currentPlayer = currentRoom.players.find((p) => {
        const pid = p.id || p.playerId;
        return pid === currentPlayerId;
      });
      const playerName = currentPlayer ? currentPlayer.name : "Unknown Player";
      indicator.textContent = `${playerName}'s Turn`;
    }
  }

  function handleRoomJoined(data) {
    currentRoom = data.room;
    updateRoomCode(currentRoom.code);
    updatePlayerList(currentRoom.players);

    if (data.reconnected && data.room.gameStarted && data.gameState) {
      gameState = data.gameState;

      document.getElementById("roomOptions")?.classList.add("hidden");
      document.getElementById("gameBoard")?.classList.remove("hidden");

      if (gameState.topCard && UI && UI.renderTopCard)
        UI.renderTopCard(
          document.getElementById("discardPile"),
          gameState.topCard,
        );
      if (gameState.currentColor && UI && UI.updateColorIndicator)
        UI.updateColorIndicator("colorIndicator", gameState.currentColor);

      if (data.hand && data.hand.length > 0) {
        myHand = data.hand;
        if (UI && UI.renderHand)
          UI.renderHand("playerCards", myHand, {
            gameState,
            playerId,
            onCardClick: handleCardClick,
          });
      }

      if (UI && UI.renderOpponents) UI.renderOpponents(gameState, playerId);
      updateDrawPileState();
      updateTurnIndicator();

      Utils && Utils.showNotification
        ? Utils.showNotification("Reconnected to game", "success")
        : _log("Reconnected to game");
      return;
    }

    if (data.reconnected && !data.room.gameStarted) {
      Utils && Utils.showNotification
        ? Utils.showNotification("Reconnected to room", "success")
        : _log("Reconnected to room");
    }

    const startBtn = document.getElementById("startGameBtn");
    if (startBtn && !startBtn.dataset.listenerAdded) {
      startBtn.addEventListener("click", () => {
        if (Sock) Sock.emit("game:start");
      });
      startBtn.dataset.listenerAdded = "true";
    }
  }

  function handleRoomRejoined(data) {
    currentRoom = data.room;
    updateRoomCode(currentRoom.code);
    updatePlayerList(currentRoom.players);

    if (data.room.gameStarted && data.gameState) {
      gameState = data.gameState;

      document.getElementById("roomOptions")?.classList.add("hidden");
      document.getElementById("gameBoard")?.classList.remove("hidden");

      if (gameState.topCard && UI && UI.renderTopCard)
        UI.renderTopCard(
          document.getElementById("discardPile"),
          gameState.topCard,
        );
      if (data.hand && data.hand.length > 0) {
        myHand = data.hand;
        if (UI && UI.renderHand)
          UI.renderHand("playerCards", myHand, {
            gameState,
            playerId,
            onCardClick: handleCardClick,
          });
      }

      if (UI && UI.renderOpponents) UI.renderOpponents(gameState, playerId);
      updateDrawPileState();
      updateTurnIndicator();

      Utils && Utils.showNotification
        ? Utils.showNotification("Reconnected to game", "success")
        : _log("Reconnected to game");
    } else {
      Utils && Utils.showNotification
        ? Utils.showNotification("Reconnected to room", "success")
        : _log("Reconnected to room");
    }
  }

  function handleRoomError(data) {
    console.error("Room error:", data);
    if (Utils && Utils.showNotification)
      Utils.showNotification(data.message || "Failed to join room", "error");
    const criticalErrors = ["Room not found", "Failed to join room"];
    if (criticalErrors.some((err) => data.message?.includes(err))) {
      setTimeout(() => (window.location.href = "/"), 2000);
    }
  }

  function handlePlayerJoined(data) {
    if (currentRoom && data.players) {
      currentRoom.players = data.players;
      updatePlayerList(data.players);
      if (currentRoom.gameStarted && gameState && UI && UI.renderOpponents) {
        UI.renderOpponents(gameState, playerId);
      }
      if (Utils && Utils.showNotification)
        Utils.showNotification(
          `${data.name || "A player"} joined the room`,
          "success",
        );
    }
  }

  function handlePlayerLeft(data) {
    if (currentRoom && data.players) {
      currentRoom.players = data.players;
      updatePlayerList(data.players);
      if (currentRoom.gameStarted && gameState && UI && UI.renderOpponents)
        UI.renderOpponents(gameState, playerId);

      if (data.players.length === 0) {
        Utils && Utils.showNotification
          ? Utils.showNotification("Room is empty", "info")
          : _log("Room is empty");
        setTimeout(() => (window.location.href = "/"), 1500);
      }
    }
  }

  function handlePlayerDisconnected(data) {
    if (currentRoom && data.players) {
      currentRoom.players = data.players;
      updatePlayerList(data.players);
    }
  }

  function handlePlayerReconnected(data) {
    if (currentRoom && data.players) {
      currentRoom.players = data.players;
      updatePlayerList(data.players);
      if (currentRoom.gameStarted && gameState && UI && UI.renderOpponents)
        UI.renderOpponents(gameState, playerId);
      if (Utils && Utils.showNotification)
        Utils.showNotification(
          `${data.name || "A player"} reconnected`,
          "success",
        );
    }
  }

  function handleGameStarted(data) {
    if (currentRoom) currentRoom.gameStarted = true;
    gameState = data.gameState || gameState;

    document.getElementById("startGameBtn")?.classList.add("hidden");
    document.getElementById("roomOptions")?.classList.add("hidden");
    document.getElementById("gameBoard")?.classList.remove("hidden");

    if (gameState && gameState.topCard && UI && UI.renderTopCard)
      UI.renderTopCard(
        document.getElementById("discardPile"),
        gameState.topCard,
      );
    if (gameState && gameState.currentColor && UI && UI.updateColorIndicator)
      UI.updateColorIndicator("colorIndicator", gameState.currentColor);

    if (data.hand) {
      myHand = data.hand;
      if (UI && UI.renderHand)
        UI.renderHand("playerCards", myHand, {
          gameState,
          playerId,
          onCardClick: handleCardClick,
        });
    }

    if (UI && UI.renderOpponents) UI.renderOpponents(gameState, playerId);

    updateDrawPileState();
    updateTurnIndicator();

    if (Utils && Utils.showNotification)
      Utils.showNotification("Game started!", "success");
  }

  function handleGameStateUpdate(data) {
    gameState = data.gameState;

    if (data.hand) {
      myHand = data.hand;
      if (UI && UI.renderHand)
        UI.renderHand("playerCards", myHand, {
          gameState,
          playerId,
          onCardClick: handleCardClick,
        });
    }

    if (data.gameState?.topCard && UI && UI.renderTopCard)
      UI.renderTopCard(
        document.getElementById("discardPile"),
        data.gameState.topCard,
      );
    if (data.gameState?.currentColor && UI && UI.updateColorIndicator)
      UI.updateColorIndicator("colorIndicator", data.gameState.currentColor);

    if (UI && UI.renderOpponents) UI.renderOpponents(gameState, playerId);

    updateDrawPileState();
    updateTurnIndicator();

    if (
      gameState.currentPlayerId === playerId &&
      gameState.drawCount > 0 &&
      data.hand
    ) {
      const top = gameState.topCard;
      const canStack = V
        ? V.hasStackable(data.hand, top)
        : data.hand.some(
            (c) =>
              (top.type === "draw2" && c.type === "draw2") ||
              (top.type === "wild4" && c.type === "wild4"),
          );
      if (!canStack) {
        const penaltyAmount = gameState.drawCount;
        Utils && Utils.showNotification
          ? Utils.showNotification(
              `Drawing ${penaltyAmount} penalty card${penaltyAmount > 1 ? "s" : ""}...`,
              "info",
            )
          : _log(`Drawing ${penaltyAmount} penalty card(s)`);
        setTimeout(() => {
          if (Sock) Sock.emit("game:drawCard");
        }, 1000);
      }
    } else if (
      gameState.currentPlayerId === playerId &&
      data.hand &&
      !gameState.hasDrawnThisTurn
    ) {
      const top = gameState.topCard;
      const currentColor = gameState.currentColor;
      const hasPlayable = V
        ? V.hasPlayableCard(data.hand, top, currentColor)
        : data.hand.some(
            (c) =>
              c.color === "wild" ||
              c.color === currentColor ||
              c.value === top.value,
          );
      if (!hasPlayable) {
        Utils && Utils.showNotification
          ? Utils.showNotification("No playable cards - drawing...", "info")
          : _log("No playable cards - drawing...");
        setTimeout(() => {
          if (Sock) Sock.emit("game:drawCard");
        }, 800);
      }
    }
  }

  function handleGameWinner(data) {
    const winner = currentRoom?.players.find(
      (p) => (p.id || p.playerId) === data.winnerId,
    );
    const winnerName = winner ? winner.name : "Someone";
    if (Utils && Utils.showNotification)
      Utils.showNotification(`${winnerName} won the game!`, "success");

    setTimeout(() => {
      document.getElementById("gameBoard")?.classList.add("hidden");
      document.getElementById("roomOptions")?.classList.remove("hidden");
    }, 3000);
  }

  function handlePlayerKicked(data) {
    if (UI && UI.showKickedNotification)
      UI.showKickedNotification(data.kickedBy || "Admin");
    else {
      alert("You were kicked from the room.");
      window.location.href = "/";
    }
  }

  function handleAdminChanged(data) {
    if (currentRoom) {
      const newAdminIndex = currentRoom.players.findIndex(
        (p) => (p.id || p.playerId) === data.newAdminId,
      );
      if (newAdminIndex > 0) {
        const newAdmin = currentRoom.players.splice(newAdminIndex, 1)[0];
        currentRoom.players.unshift(newAdmin);
        updatePlayerList(currentRoom.players);
      }
    }

    Utils && Utils.showNotification
      ? Utils.showNotification(
          `${data.newAdminName} is now the room admin`,
          "info",
        )
      : _log(`${data.newAdminName} is now the room admin`);
    if ((data.newAdminId || "") === playerId) {
      Utils && Utils.showNotification
        ? Utils.showNotification("You are now the room admin!", "success")
        : _log("You are now the room admin!");
    }
  }

  function setupSocketHandlers() {
    if (!Sock) {
      console.warn("Socket not available - socket handlers not registered.");
      return;
    }

    Sock.on("room:joined", (d) => handleRoomJoined(d));
    Sock.on("room:rejoined", (d) => handleRoomRejoined(d));
    Sock.on("room:error", (d) => handleRoomError(d));
    Sock.on("player:joined", (d) => handlePlayerJoined(d));
    Sock.on("player:left", (d) => handlePlayerLeft(d));
    Sock.on("player:disconnected", (d) => handlePlayerDisconnected(d));
    Sock.on("player:reconnected", (d) => handlePlayerReconnected(d));
    Sock.on("player:kicked", (d) => handlePlayerKicked(d));
    Sock.on("admin:changed", (d) => handleAdminChanged(d));
    Sock.on("game:started", (d) => handleGameStarted(d));
    Sock.on("game:stateUpdate", (d) => handleGameStateUpdate(d));
    Sock.on("game:winner", (d) => handleGameWinner(d));
    Sock.on("connect", () => {
      _log("Connected to server");
    });
    Sock.on("disconnect", () => {
      if (Utils)
        Utils.showNotification("Connection lost. Reconnecting...", "error");
    });
  }

  function initializeSocket(roomCode, playerName) {
    if (!Sock) {
      console.error("Socket not initialized - cannot join room");
      return;
    }

    Sock.init();
    playerId = Sock.getPlayerId ? Sock.getPlayerId() : playerId;
    setupSocketHandlers();

    Sock.on("connect", () => {
      setTimeout(() => {
        if (Sock && typeof Sock.joinRoom === "function") {
          Sock.joinRoom(roomCode, playerName);
        } else if (Sock && typeof Sock.emit === "function") {
          const cleanCode = (roomCode || "").replace(/-/g, "");
          Sock.emit("room:join", {
            code: cleanCode,
            playerId,
            name: playerName,
          });
        }
      }, 100);
    });
  }

  function init() {
    if (isInitializing) return;
    isInitializing = true;

    (async () => {
      const ready = await ensureGameLayout();
      if (!ready) {
        Utils && Utils.showNotification
          ? Utils.showNotification("Failed to load game UI", "error")
          : alert("Failed to load game UI");
        isInitializing = false;
        return;
      }

    const roomCode =
      Utils && Utils.getRoomCodeFromURL
        ? Utils.getRoomCodeFromURL()
        : (() => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");
            return code ? code.replace(/-/g, "") : null;
          })();

    if (!roomCode) {
      Utils && Utils.showNotification
        ? Utils.showNotification("No room code provided", "error")
        : alert("No room code provided");
      setTimeout(() => (window.location.href = "/"), 1500);
      isInitializing = false;
      return;
    }

    const roomCodeIsValid =
      Utils && typeof Utils.isValidRoomCode === "function"
        ? Utils.isValidRoomCode(roomCode)
        : /^\d{6}$/.test(String(roomCode || "").replace(/-/g, ""));
    if (!roomCodeIsValid) {
      Utils && Utils.showNotification
        ? Utils.showNotification(
            "Invalid room code format. Please join using a valid 6-digit code.",
            "error",
          )
        : alert("Invalid room code format.");
      setTimeout(() => (window.location.href = "/"), 1500);
      isInitializing = false;
      return;
    }

    let playerName =
      Utils && Utils.getPlayerName
        ? Utils.getPlayerName()
        : localStorage.getItem("playerName");
    if (!playerName) {
      if (Utils && Utils.showNamePrompt) {
        Utils.showNamePrompt((name) => {
          initializeSocket(roomCode, name);
        });
        return;
      } else {
        playerName = prompt("Enter your player name:") || "Player";
        initializeSocket(roomCode, playerName);
      }
    } else {
      initializeSocket(roomCode, playerName);
    }

    const settingsIcon = document.getElementById("settingsIcon");
    settingsIcon?.addEventListener("click", () => {
      const gameActive = currentRoom && currentRoom.gameStarted;
      if (Utils && Utils.showSettingsDialog) {
        Utils.showSettingsDialog((settings) => {
          if (Utils && Utils.showNotification)
            Utils.showNotification("Settings saved!", "success");
          if (!gameActive && currentRoom && settings.name && Sock) {
            Sock.emit("player:updateName", { name: settings.name });
          }
        }, gameActive);
      }
    });

    setTimeout(() => {
      const drawPile = document.getElementById("drawPile");
      if (drawPile) {
        drawPile.addEventListener("click", () => handleDrawCard());
      }
    }, 100);
      isInitializing = false;
    })();
  }

  return {
    init,
    initializeSocket,
    _getState: () => ({ currentRoom, playerId, gameState, myHand }),
  };
})();

if (typeof window !== "undefined") window.Game = Game;
