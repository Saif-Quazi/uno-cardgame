(function () {
  "use strict";

  const PLAYER_ID_KEY = "playerId";
  const PLAYER_NAME_KEY = "playerName";
  const VOLUME_KEY = "gameVolume";
  const MUTED_KEY = "gameMuted";

  const notificationQueue = [];
  let isShowingNotification = false;

  const Validate = {
    getPlayerId(obj) {
      if (!obj) return null;
      if (typeof obj === "string") return obj;
      if (typeof obj === "number") return String(obj);
      if (typeof obj === "object") {
        if (obj.id) return obj.id;
        if (obj.playerId) return obj.playerId;
      }
      return null;
    },

    isPlayerTurn(gameState, playerId) {
      if (!gameState || !playerId) return false;
      return gameState.currentPlayerId === playerId;
    },

    canPlayCard(card, topCard, currentColor) {
      if (!card) return false;
      if (!topCard) return false;

      if (card.color === "wild") return true;

      if (currentColor && card.color === currentColor) return true;

      if (!currentColor && card.color === topCard.color) return true;

      if (
        card.value !== undefined &&
        topCard.value !== undefined &&
        card.value === topCard.value
      )
        return true;

      if (card.type && topCard.type && card.type === topCard.type) return true;

      return false;
    },

    canStack(card, topCard) {
      if (!card || !topCard) return false;
      return (
        (card.type === "draw2" && topCard.type === "draw2") ||
        (card.type === "wild4" && topCard.type === "wild4")
      );
    },

    hasStackable(hand, topCard) {
      if (!Array.isArray(hand) || !topCard) return false;
      return hand.some((c) => Validate.canStack(c, topCard));
    },

    hasPlayableCard(hand, topCard, currentColor) {
      if (!Array.isArray(hand) || !topCard) return false;
      return hand.some((card) =>
        Validate.canPlayCard(card, topCard, currentColor),
      );
    },

    canDraw(gameState, playerId) {
      if (!gameState || !playerId) return false;
      return (
        gameState.currentPlayerId === playerId &&
        (gameState.drawCount > 0 || !gameState.hasDrawnThisTurn)
      );
    },

    isAdmin(room, playerId) {
      if (!room || !Array.isArray(room.players) || !playerId) return false;
      const adminId = Validate.getPlayerId(room.players[0]);
      return adminId === playerId;
    },

    canStartGame(room, playerId, currentCount, maxCount) {
      if (
        !room ||
        !playerId ||
        typeof currentCount !== "number" ||
        typeof maxCount !== "number"
      )
        return false;
      return (
        Validate.isAdmin(room, playerId) &&
        currentCount >= 2 &&
        currentCount <= maxCount
      );
    },

    isValidRoomCode(code) {
      if (!code && code !== "") return false;
      const clean = ("" + code).replace(/-/g, "").trim();
      return clean.length === 6 && /^\d{6}$/.test(clean);
    },

    formatRoomCode(code) {
      if (!code && code !== "") return "";
      const clean = ("" + code).replace(/-/g, "");
      if (clean.length !== 6) return code;
      return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    },

    formatRoomCodeInput(value) {
      if (!value) return "";
      let cleanValue = String(value).replace(/[^0-9]/g, "");
      if (cleanValue.length > 3) {
        cleanValue = cleanValue.slice(0, 3) + "-" + cleanValue.slice(3, 6);
      }
      return cleanValue;
    },

    sanitizeName(name) {
      if (!name && name !== "") return "";
      return String(name)
        .replace(/[^a-zA-Z0-9]/g, "")
        .trim();
    },

    isValidName(name) {
      const s = Validate.sanitizeName(name);
      return s.length >= 2 && s.length <= 15;
    },
  };

  const User = {
    sanitizeName(name) {
      return Validate.sanitizeName(name);
    },

    isValidName(name) {
      return Validate.isValidName(name);
    },

    getPlayerName() {
      const name = localStorage.getItem(PLAYER_NAME_KEY);
      return name || null;
    },

    setPlayerName(name) {
      const sanitized = Validate.sanitizeName(name);
      if (Validate.isValidName(sanitized)) {
        localStorage.setItem(PLAYER_NAME_KEY, sanitized);
        return sanitized;
      }
      return null;
    },

    clearPlayerName() {
      localStorage.removeItem(PLAYER_NAME_KEY);
    },

    getPlayerId() {
      let id = localStorage.getItem(PLAYER_ID_KEY);
      if (!id) {
        id = `player_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        localStorage.setItem(PLAYER_ID_KEY, id);
      }
      return id;
    },

    getVolume() {
      const volume = localStorage.getItem(VOLUME_KEY);
      return volume !== null ? parseInt(volume, 10) : 70;
    },

    setVolume(volume) {
      localStorage.setItem(VOLUME_KEY, Math.max(0, Math.min(100, volume)));
    },

    isMuted() {
      return localStorage.getItem(MUTED_KEY) === "true";
    },

    setMuted(muted) {
      localStorage.setItem(MUTED_KEY, muted ? "true" : "false");
    },

    sliderToVolume(sliderValue) {
      return Math.pow(sliderValue / 100, 2);
    },

    volumeToSlider(volume) {
      return Math.sqrt(volume) * 100;
    },

    showSettingsDialog(callback, gameActive = false) {
      const template = document.getElementById("settingsDialog");
      if (!template) return;

      const clone = template.content.cloneNode(true);
      const dialog = clone.querySelector(".modal-overlay");
      if (!dialog) return;

      document.body.appendChild(clone);

      const nameInput = dialog.querySelector(".name-input");
      const volumeSlider = dialog.querySelector(".volume-slider");
      const volumeValue = dialog.querySelector(".volume-value");
      const muteToggle = dialog.querySelector(".mute-toggle");
      const muteIcon = muteToggle ? muteToggle.querySelector("i") : null;
      const saveBtn = dialog.querySelector(".save-settings-btn");
      const cancelBtn = dialog.querySelector(".cancel-btn");

      const currentName = User.getPlayerName();
      if (currentName) {
        if (nameInput) nameInput.value = currentName;
      }

      if (gameActive && nameInput) {
        nameInput.disabled = true;
        nameInput.style.opacity = "0.5";
        nameInput.style.cursor = "not-allowed";
        nameInput.title = "Cannot change name during active game";
      }

      const currentVolume = User.getVolume();
      const currentMuted = User.isMuted();

      if (volumeSlider) volumeSlider.value = currentVolume;
      if (volumeValue) volumeValue.textContent = currentVolume + "%";

      if (currentMuted && muteToggle) {
        muteToggle.classList.add("muted");
        if (muteIcon) muteIcon.className = "fas fa-volume-mute";
      }

      if (nameInput) {
        nameInput.addEventListener("input", (e) => {
          const cursorPos = e.target.selectionStart;
          const sanitized = User.sanitizeName(e.target.value);
          e.target.value = sanitized;
          e.target.setSelectionRange(cursorPos, cursorPos);
        });
      }

      if (volumeSlider) {
        volumeSlider.addEventListener("input", (e) => {
          const value = parseInt(e.target.value, 10);
          if (volumeValue) volumeValue.textContent = value + "%";
        });
      }

      if (muteToggle) {
        muteToggle.addEventListener("click", () => {
          const isMutedNow = muteToggle.classList.toggle("muted");
          if (isMutedNow) {
            if (muteIcon) muteIcon.className = "fas fa-volume-mute";
          } else {
            if (muteIcon) muteIcon.className = "fas fa-volume-up";
          }
        });
      }

      if (saveBtn) {
        saveBtn.addEventListener("click", () => {
          const name = nameInput ? nameInput.value.trim() : null;
          const volume = volumeSlider
            ? parseInt(volumeSlider.value, 10)
            : User.getVolume();
          const muted = muteToggle
            ? muteToggle.classList.contains("muted")
            : User.isMuted();

          if (!gameActive && name && User.isValidName(name)) {
            User.setPlayerName(name);
          }

          User.setVolume(volume);
          User.setMuted(muted);

          dialog.remove();

          if (callback) {
            callback({
              name: name || currentName,
              volume,
              muted,
              actualVolume: User.sliderToVolume(volume),
            });
          }
        });
      }

      if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
          dialog.remove();
        });
      }

      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) {
          dialog.remove();
        }
      });

      if (nameInput) nameInput.focus();
    },

    showNamePrompt(callback) {
      const template = document.getElementById("namePromptDialog");
      if (!template) return;

      const clone = template.content.cloneNode(true);
      const dialog = clone.querySelector(".modal-overlay");
      if (!dialog) return;

      document.body.appendChild(clone);

      const input = dialog.querySelector(".name-input");
      const confirmBtn = dialog.querySelector(".confirm-name-btn");

      const existingName = User.getPlayerName();
      if (existingName && input) input.value = existingName;

      if (input) {
        input.addEventListener("input", (e) => {
          const cursorPos = e.target.selectionStart;
          const sanitized = User.sanitizeName(e.target.value);
          e.target.value = sanitized;
          e.target.setSelectionRange(cursorPos, cursorPos);
        });
      }

      const handleConfirm = () => {
        const name = input ? input.value.trim() : "";
        if (User.isValidName(name)) {
          const sanitized = User.setPlayerName(name);
          if (sanitized) {
            dialog.remove();
            if (typeof callback === "function") callback(sanitized);
          }
        } else {
          Utils.shakeElement(input || dialog);
          if (typeof Utils.showNotification === "function") {
            Utils.showNotification(
              "Name must be 2-15 alphanumeric characters",
              "error",
            );
          }
        }
      };

      if (input) input.focus();
      if (confirmBtn) confirmBtn.addEventListener("click", handleConfirm);
      if (input) {
        input.addEventListener("keypress", (e) => {
          if (e.key === "Enter") handleConfirm();
        });
      }

      if (!existingName) {
        dialog.addEventListener("click", (e) => {
          if (e.target === dialog) {
            Utils.shakeElement(dialog.querySelector(".modal-dialog"));
          }
        });
      } else {
        dialog.addEventListener("click", (e) => {
          if (e.target === dialog) {
            dialog.remove();
            if (typeof callback === "function") callback(existingName);
          }
        });
      }
    },
  };

  const Utils = {
    processNotificationQueue() {
      if (isShowingNotification || notificationQueue.length === 0) {
        return;
      }

      isShowingNotification = true;
      const { message, type } = notificationQueue.shift();

      const colors = {
        error: "#ff4444",
        success: "#4CAF50",
        info: "#2196F3",
      };

      const notification = document.createElement("div");
      notification.className = "notification";
      notification.style.background = colors[type] || colors.info;
      notification.textContent = message;
      document.body.appendChild(notification);

      const displayTime = type === "error" ? 3000 : 2000;

      setTimeout(() => {
        notification.style.animation = "slideOut 0.3s ease forwards";
        setTimeout(() => {
          notification.remove();
          isShowingNotification = false;
          Utils.processNotificationQueue();
        }, 300);
      }, displayTime);
    },

    showNotification(message, type = "info") {
      notificationQueue.push({ message, type });
      Utils.processNotificationQueue();
    },

    formatRoomCode(code) {
      return Validate.formatRoomCode(code);
    },

    getRoomCodeFromURL() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      return code ? code.replace(/-/g, "") : null;
    },

    isValidRoomCode(code) {
      return Validate.isValidRoomCode(code);
    },

    formatRoomCodeInput(value) {
      return Validate.formatRoomCodeInput(value);
    },

    shakeElement(element) {
      if (!element) return;
      element.style.animation = "shake 0.5s";
      setTimeout(() => {
        element.style.animation = "";
      }, 500);
    },

    escapeHtml(text) {
      if (text === undefined || text === null) return "";
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };
      return String(text).replace(/[&<>"']/g, (m) => map[m]);
    },

    getPlayerName() {
      return User.getPlayerName();
    },

    setPlayerName(name) {
      return User.setPlayerName(name);
    },

    getPlayerId() {
      return User.getPlayerId();
    },

    getVolume() {
      return User.getVolume();
    },

    setVolume(v) {
      return User.setVolume(v);
    },

    isMuted() {
      return User.isMuted();
    },

    setMuted(m) {
      return User.setMuted(m);
    },

    sliderToVolume(v) {
      return User.sliderToVolume(v);
    },

    volumeToSlider(v) {
      return User.volumeToSlider(v);
    },

    showSettingsDialog(callback, gameActive = false) {
      return User.showSettingsDialog(callback, gameActive);
    },

    showNamePrompt(callback) {
      return User.showNamePrompt(callback);
    },

    Validate,
    User,
  };

  window.Utils = Utils;
  window.UnoUtils = Utils;
  window.Validate = Validate;
  window.UserUtils = User;
})();
