const SOCKET_EVENTS = [
  "connect",
  "disconnect",
  "error",
  "room:joined",
  "room:rejoined",
  "room:left",
  "room:error",
  "player:joined",
  "player:left",
  "player:disconnected",
  "player:reconnected",
  "game:started",
  "game:stateUpdate",
  "game:winner",
  "player:kicked",
  "admin:changed",
  "game:action",
];

const RECONNECTION_OPTIONS = {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
};

const PLAYER_ID_KEY = "playerId";
const PLAYER_NAME_KEY = "playerName";

const Socket = (() => {
  let socket = null;
  let playerId = null;
  let playerName = "Player";
  let connected = false;
  const eventHandlers = new Map();

  function init() {
    if (socket) return;

    playerId = UserUtils.getPlayerId ? UserUtils.getPlayerId() : null;
    if (!playerId) {
      playerId = localStorage.getItem(PLAYER_ID_KEY);
    }
    if (!playerId) {
      playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem(PLAYER_ID_KEY, playerId);
    }

    playerName = UserUtils.getPlayerName
      ? UserUtils.getPlayerName()
      : localStorage.getItem(PLAYER_NAME_KEY) || "Player";

    socket = io(RECONNECTION_OPTIONS);
    setupSocketListeners();
  }

  function setupSocketListeners() {
    SOCKET_EVENTS.forEach((event) => {
      socket.on(event, (data) => {
        if (event === "connect") {
          connected = true;
          socket.emit("player:join", { playerId, name: playerName });
          console.log("Socket connected.");
        }
        if (event === "disconnect") {
          connected = false;
          console.log("Socket disconnected.");
        }
        if (event === "room:error") {
          console.error("Room error received:", data, "Message:", data.message);
        }
        if (event === "game:stateUpdate") {
          console.log("Game state update received");
        }
        triggerEvent(event, data);
      });
    });
  }

  function joinRoom(code, name = null) {
    if (!socket || !connected) {
      setTimeout(() => joinRoom(code, name), 500);
      return;
    }

    const cleanCode = String(code || "").replace(/-/g, "").trim();
    const isValidCode = /^\d{6}$/.test(cleanCode);
    if (!isValidCode) {
      triggerEvent("room:error", {
        message: "Invalid room code. Use a 6-digit code.",
      });
      return;
    }

    if (!playerId) {
      triggerEvent("room:error", {
        message: "Unable to join room: missing player ID.",
      });
      return;
    }

    if (name) {
      playerName = name;
      localStorage.setItem(PLAYER_NAME_KEY, name);
    }

    socket.emit("room:join", { code: cleanCode, playerId, name: playerName });
    console.log(`Joining room: ${cleanCode} as ${playerName}`);
  }

  function leaveRoom(code) {
    socket.emit("room:leave", { code, playerId });
    console.log(`Leaving room: ${code}`);
  }

  function startGame(code) {
    socket.emit("game:start", { code });
    console.log(`Starting game in room: ${code}`);
  }

  function sendAction(code, action, data) {
    socket.emit("game:action", { code, action, data });
    console.log(`Sending action: ${action} in room: ${code}`);
  }

  function on(event, handler) {
    if (!eventHandlers.has(event)) eventHandlers.set(event, []);
    eventHandlers.get(event).push(handler);
  }

  function off(event, handler) {
    if (eventHandlers.has(event)) {
      const handlers = eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }
  }

  function triggerEvent(event, data = {}) {
    if (eventHandlers.has(event)) {
      eventHandlers.get(event).forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  function getPlayerIdExport() {
    return playerId;
  }

  function isConnected() {
    return connected;
  }

  function emit(event, data) {
    if (!socket) return;
    socket.emit(event, data);
  }

  return {
    init,
    joinRoom,
    leaveRoom,
    startGame,
    sendAction,
    on,
    off,
    emit,
    getPlayerId: getPlayerIdExport,
    isConnected,
  };
})();

if (typeof window !== "undefined") window.Socket = Socket;
