// UI helpers for UNO client
// Provides DOM rendering and modal helpers.
// Exposes global `UnoUI` with functions for rendering cards, hands, opponents and dialogs.
//
// This module is intentionally DOM-only: it does not emit socket events or perform validation.
// Consumers should provide callbacks (e.g. play/draw/kick) when wiring UI to networking/logic layers.

const UnoUI = (() => {
  "use strict";

  // Utilities (use UnoUtils if available)
  const _escapeHtml =
    (typeof UnoUtils !== "undefined" && UnoUtils.escapeHtml) ||
    function (text = "") {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

  function _createGradientId() {
    return `gradient-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // Card display helpers (same logic used by the previous client implementation)
  function getCardDisplayInfo(card) {
    let display = "";
    let dataValue = "";
    let cornerSize = "16";
    let centerSize = "38";
    let centerY = "90";

    if (!card) {
      return { display: "", dataValue: "", cornerSize, centerSize, centerY };
    }

    if (card.color === "wild") {
      if (card.value === "wild4") {
        display = "+4";
        dataValue = "+4";
        centerSize = "32";
        centerY = "88";
        cornerSize = "14";
      } else {
        display = "W";
        dataValue = "wild";
        centerSize = "38";
      }
    } else if (card.type === "draw2") {
      display = "+2";
      dataValue = `${card.color}+2`;
      centerSize = "32";
      centerY = "88";
      cornerSize = "14";
    } else if (card.type === "skip") {
      display = "⊘";
      dataValue = `${card.color}skip`;
      centerSize = "48";
      centerY = "95";
    } else if (card.type === "reverse") {
      display = "⇄";
      dataValue = `${card.color}reverse`;
      centerSize = "40";
      centerY = "92";
    } else {
      display = String(card.value);
      dataValue = `${card.color}${card.value}`;
      centerSize = "38";
    }

    return { display, dataValue, cornerSize, centerSize, centerY };
  }

  function getCardDataValue(card) {
    if (!card) return "";
    if (card.color === "wild") {
      return card.value === "wild4" ? "+4" : "wild";
    }

    if (card.type === "draw2") {
      return `${card.color}+2`;
    }
    if (card.type === "skip") {
      return `${card.color}skip`;
    }
    if (card.type === "reverse") {
      return `${card.color}reverse`;
    }

    return `${card.color}${card.value}`;
  }

  // Create a card DOM element (DIV with SVG inside). Returns DOM Node.
  function createCardElement(card) {
    const cardEl = document.createElement("div");
    cardEl.className = "card";

    const cardInfo = getCardDisplayInfo(card);

    cardEl.dataset.value = cardInfo.dataValue;
    cardEl.dataset.color = card?.color || "";
    cardEl.dataset.type = card?.type || "";

    // Build an SVG markup string for simpler, consistent visuals
    const gradientId = _createGradientId();

    const color = (card?.color || "").toLowerCase();
    const display = cardInfo.display;
    const cornerSize = cardInfo.cornerSize;
    const centerSize = cardInfo.centerSize;
    const centerY = cardInfo.centerY;
    const textColor = color === "yellow" ? "#000" : "#fff";

    // Basic gradient stops per color
    const gradients = {
      red: `<stop offset="0%" style="stop-color:#ff3030"/><stop offset="100%" style="stop-color:#d72600"/>`,
      blue: `<stop offset="0%" style="stop-color:#3d8cff"/><stop offset="100%" style="stop-color:#0956bf"/>`,
      green: `<stop offset="0%" style="stop-color:#4cb848"/><stop offset="100%" style="stop-color:#379711"/>`,
      yellow: `<stop offset="0%" style="stop-color:#ffeb3b"/><stop offset="100%" style="stop-color:#ecd407"/>`,
      wild: `<stop offset="0%" style="stop-color:#d72600"/><stop offset="25%" style="stop-color:#0956bf"/><stop offset="50%" style="stop-color:#379711"/><stop offset="75%" style="stop-color:#ecd407"/><stop offset="100%" style="stop-color:#d72600"/>`,
      default: `<stop offset="0%" style="stop-color:#ddd"/><stop offset="100%" style="stop-color:#bbb"/>`,
    };

    const gradStops = gradients[color] || gradients.default;

    // SVG markup
    let svgMarkup = `<svg viewBox="0 0 100 155" class="card-svg" xmlns="http://www.w3.org/2000/svg">`;
    svgMarkup += `<defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">${gradStops}</linearGradient></defs>`;

    // background rectangle using gradient
    const bgFill = color === "wild" ? "#222" : `url(#${gradientId})`;
    const border = color === "wild" ? "#fff" : "#ffffff";
    svgMarkup += `<rect x="2" y="2" width="96" height="151" rx="12" ry="12" fill="${bgFill}" stroke="${border}" stroke-width="2"/>`;

    // Helper functions for corner text
    function cornerText(text) {
      return `<text x="18" y="28" font-family="Poppins, Arial, sans-serif" font-size="${cornerSize}" font-weight="700" fill="${textColor}">${_escapeHtml(String(text))}</text>`;
    }
    function bottomCornerText(text) {
      // rotate 180 around bottom-right corner area
      return `<g transform="translate(100,155) rotate(180)">${cornerText(text)}</g>`;
    }

    // center oval (outline) - main visual element
    svgMarkup += `<ellipse cx="50" cy="77.5" rx="34" ry="52" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="3" transform="rotate(35 50 77.5)"/>`;

    // Render center and corners based on type
    const type = (card?.type || "").toLowerCase();

    if (type === "number") {
      svgMarkup += `<g class="corner-top">${cornerText(display)}</g>`;
      svgMarkup += `<g class="center-text"><text x="50" y="${centerY}" font-family="Poppins, Arial, sans-serif" font-size="${centerSize}" font-weight="800" text-anchor="middle" fill="${textColor}">${_escapeHtml(String(display))}</text></g>`;
      svgMarkup += `<g class="corner-bottom">${bottomCornerText(display)}</g>`;
    } else if (type === "draw2") {
      svgMarkup += `<g class="corner-top">${cornerText("+2")}</g>`;
      svgMarkup += `<g class="center-text"><text x="50" y="${centerY}" font-family="Poppins, Arial, sans-serif" font-size="${centerSize}" font-weight="800" text-anchor="middle" fill="${textColor}">+2</text></g>`;
      svgMarkup += `<g class="corner-bottom">${bottomCornerText("+2")}</g>`;
    } else if (type === "skip") {
      // Use Font Awesome icon inside foreignObject if available; fallback to simple X
      svgMarkup += `<g class="corner-top">${cornerText("✕")}</g>`;
      svgMarkup += `<foreignObject x="30" y="50" width="40" height="40"><body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background:transparent;"><div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:${textColor};"><i class="fa-solid fa-ban" style="font-size:28px;line-height:1"></i></div></body></foreignObject>`;
      svgMarkup += `<g class="corner-bottom">${bottomCornerText("✕")}</g>`;
    } else if (type === "reverse") {
      svgMarkup += `<g class="corner-top">${cornerText("↺")}</g>`;
      svgMarkup += `<foreignObject x="30" y="52" width="40" height="40"><body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background:transparent;"><div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:${textColor};"><i class="fa-solid fa-arrows-rotate" style="font-size:26px;line-height:1"></i></div></body></foreignObject>`;
      svgMarkup += `<g class="corner-bottom">${bottomCornerText("↺")}</g>`;
    } else if (
      color === "wild" ||
      String(card?.value || "")
        .toLowerCase()
        .includes("wild")
    ) {
      // Wild card: center oval contains four color marks (red/blue/green/yellow)
      // interior colored circles placed within the oval
      const quarter = [
        { cx: 36, cy: 65, fill: "#e53935" }, // red (top-left)
        { cx: 64, cy: 65, fill: "#1e88e5" }, // blue (top-right)
        { cx: 36, cy: 90, fill: "#43a047" }, // green (bottom-left)
        { cx: 64, cy: 90, fill: "#fdd835" }, // yellow (bottom-right)
      ];
      // Slightly darker center oval outline
      svgMarkup += `<ellipse cx="50" cy="77.5" rx="28" ry="40" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="2" transform="rotate(35 50 77.5)"/>`;
      quarter.forEach((q) => {
        svgMarkup += `<circle cx="${q.cx}" cy="${q.cy}" r="9" fill="${q.fill}" stroke="#222" stroke-width="0.5" />`;
      });
      // small corner ovals where the value normally is
      svgMarkup += `<ellipse cx="18" cy="28" rx="7" ry="9" fill="#e53935" stroke="#222" stroke-width="0.6" />`;
      svgMarkup += `<g transform="translate(100,155) rotate(180)"><ellipse cx="18" cy="28" rx="7" ry="9" fill="#e53935" stroke="#222" stroke-width="0.6" /></g>`;
      // center label
      if (String(card?.value).toLowerCase() === "wild4" || display === "+4") {
        svgMarkup += `<g class="center-text"><text x="50" y="${centerY}" font-family="Poppins, Arial, sans-serif" font-size="${centerSize}" font-weight="800" text-anchor="middle" fill="#fff">+4</text></g>`;
      } else {
        svgMarkup += `<g class="center-text"><text x="50" y="${centerY}" font-family="Poppins, Arial, sans-serif" font-size="${centerSize}" font-weight="800" text-anchor="middle" fill="#fff">W</text></g>`;
      }
    } else {
      // fallback
      svgMarkup += `<g class="corner-top">${cornerText(display)}</g>`;
      svgMarkup += `<g class="center-text"><text x="50" y="${centerY}" font-family="Poppins, Arial, sans-serif" font-size="${centerSize}" font-weight="700" text-anchor="middle" fill="${textColor}">${_escapeHtml(String(display))}</text></g>`;
      svgMarkup += `<g class="corner-bottom">${bottomCornerText(display)}</g>`;
    }

    svgMarkup += `</svg>`;

    // set the svg markup
    cardEl.innerHTML = svgMarkup;

    return cardEl;
  }

  // Render player's hand into a container element (id or element)
  // options:
  //  - playerId (string)
  //  - gameState (object) optional - used to determine playability styling
  //  - onCardClick(cardIndex, card, cardEl) callback for clicks
  function renderHand(containerOrId, hand = [], options = {}) {
    const container =
      typeof containerOrId === "string"
        ? document.getElementById(containerOrId)
        : containerOrId;
    if (!container) return;

    container.innerHTML = "";

    hand.forEach((card, index) => {
      const cardEl = createCardElement(card);
      cardEl.dataset.index = String(index);

      const totalCards = hand.length;
      const maxRotation = 15;
      const rotationStep =
        totalCards > 1 ? (maxRotation * 2) / (totalCards - 1) : 0;
      const rotation = -maxRotation + index * rotationStep;
      const verticalOffset = Math.abs(rotation) * 0.4;

      cardEl.style.setProperty("--rotation", `${rotation}deg`);
      cardEl.style.setProperty("--verticalOffset", `${verticalOffset}px`);

      const isPlayable =
        options.gameState &&
        options.playerId &&
        options.gameState.currentPlayerId === options.playerId;

      if (isPlayable) {
        cardEl.classList.add("playable");
        if (typeof options.onCardClick === "function") {
          cardEl.addEventListener("click", () =>
            options.onCardClick(index, card, cardEl),
          );
        }
      } else {
        cardEl.classList.add("not-playable");
      }

      container.appendChild(cardEl);
    });
  }

  // Render the top/discard pile card
  function renderTopCard(containerOrId, card) {
    const container =
      typeof containerOrId === "string"
        ? document.getElementById(containerOrId)
        : containerOrId;
    if (!container) return;

    const existingCard = container.querySelector(".card");
    if (existingCard) existingCard.remove();

    if (!card) return;

    const el = createCardElement(card);
    container.appendChild(el);
  }

  // Update a color indicator element (adds class color-<color>)
  function updateColorIndicator(indicatorOrId, color) {
    const indicator =
      typeof indicatorOrId === "string"
        ? document.getElementById(indicatorOrId)
        : indicatorOrId;
    if (!indicator) return;

    indicator.classList.remove(
      "color-red",
      "color-blue",
      "color-green",
      "color-yellow",
    );
    if (color && ["red", "blue", "green", "yellow"].includes(color)) {
      indicator.classList.add(`color-${color}`);
    }
  }

  // Render opponents into positions: top/right/bottom/left by default.
  // gameState expected to have `players` (array) with playerId/playerId|id, cardCount, name
  function renderOpponents(gameState, myPlayerId, containerIds = null) {
    if (!gameState || !Array.isArray(gameState.players)) return;

    const opponents = gameState.players.filter((p) => {
      const id = p.playerId || p.id;
      return id !== myPlayerId;
    });

    const defaultPositions = [
      "opponentTop",
      "opponentRight",
      "opponentBottom",
      "opponentLeft",
    ];
    const positions =
      Array.isArray(containerIds) && containerIds.length
        ? containerIds
        : defaultPositions;

    // clear areas
    positions.forEach((id) => {
      const area = document.getElementById(id);
      if (area) area.innerHTML = "";
    });

    opponents.forEach((opponent, index) => {
      if (index >= positions.length) return;
      const areaId = positions[index];
      const area = document.getElementById(areaId);
      if (!area) return;

      const profileCard = document.createElement("div");
      profileCard.className = "player-profile-card";

      const nameSpan = document.createElement("span");
      nameSpan.className = "profile-name";
      nameSpan.textContent = opponent.name || "Player";

      // admin indicator: first player in players array is admin
      const adminIndex = 0;
      const isAdmin =
        gameState.players[adminIndex] &&
        (gameState.players[adminIndex].playerId ||
          gameState.players[adminIndex].id) ===
          (opponent.playerId || opponent.id);

      if (isAdmin) {
        const crown = document.createElement("i");
        crown.className = "fas fa-crown profile-crown";
        nameSpan.prepend(crown);
      }

      profileCard.appendChild(nameSpan);
      area.appendChild(profileCard);

      const cardFan = document.createElement("div");
      cardFan.className = "opponent-card-fan";

      const cardCount = opponent.cardCount || 0;
      const displayCount = Math.min(cardCount, 7);
      const isVertical =
        areaId === "opponentLeft" || areaId === "opponentRight";

      for (let i = 0; i < displayCount; i++) {
        const cardImg = document.createElement("img");
        cardImg.className = "opponent-card-back";
        cardImg.src = "assets/cards/back.svg";
        cardImg.alt = "Card";

        const rotation = (i / (displayCount - 1 || 1) - 0.5) * 30;
        cardImg.style.setProperty("--card-rotation", `${rotation}deg`);

        if (isVertical) {
          const offset = (i / (displayCount - 1 || 1) - 0.5) * 40;
          cardImg.style.top = `${offset}px`;
        } else {
          const offset = (i / (displayCount - 1 || 1) - 0.5) * 40;
          cardImg.style.left = `calc(50% + ${offset}px)`;
        }

        cardFan.appendChild(cardImg);
      }

      area.appendChild(cardFan);
    });
  }

  // Show a simple color-picker modal and call callback(color)
  function showColorPicker(callback) {
    const colors = ["red", "blue", "green", "yellow"];
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay color-picker-overlay";
    overlay.innerHTML = `
      <div class="modal-dialog">
        <h2 class="modal-title">Choose a Color</h2>
        <div class="color-picker"></div>
      </div>
    `;

    const dialog = overlay.querySelector(".modal-dialog");
    const pickerContainer = dialog.querySelector(".color-picker");

    colors.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-btn";
      btn.dataset.color = color;
      btn.style.background = `var(--uno-${color})`;
      btn.textContent = color.charAt(0).toUpperCase() + color.slice(1);
      btn.addEventListener("click", () => {
        overlay.remove();
        if (typeof callback === "function") callback(color);
      });
      pickerContainer.appendChild(btn);
    });

    // clicking overlay dismisses
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  // Show kick confirmation dialog. Use template with id 'kickConfirmDialog' if present.
  // `player` object: { id | playerId, name }
  // callbacks: onConfirm(playerId), onCancel()
  function showKickConfirmation(player, onConfirm, onCancel) {
    const template = document.getElementById("kickConfirmDialog");
    let overlayEl;

    if (template && template.content) {
      const clone = template.content.cloneNode(true);
      document.body.appendChild(clone);
      const modals = document.querySelectorAll(".modal-overlay");
      overlayEl = modals[modals.length - 1];
    } else {
      overlayEl = document.createElement("div");
      overlayEl.className = "modal-overlay";
      overlayEl.innerHTML = `
        <div class="modal-dialog">
          <h2 class="modal-title">Kick Player</h2>
          <p class="kick-player-name">Are you sure you want to kick <strong>${_escapeHtml(player?.name || "Player")}</strong>?</p>
          <div class="modal-actions">
            <button class="kick-cancel-btn">Cancel</button>
            <button class="kick-confirm-btn">Kick</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlayEl);
    }

    const dialog = overlayEl;
    const cancelBtn = dialog.querySelector(".kick-cancel-btn");
    const confirmBtn = dialog.querySelector(".kick-confirm-btn");

    cancelBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      dialog.remove();
      if (typeof onCancel === "function") onCancel();
    });

    confirmBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      dialog.remove();
      const pid = player?.id || player?.playerId;
      if (typeof onConfirm === "function") onConfirm(pid);
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  // Show notification that the user was kicked. Optionally call okCallback on acknowledgement.
  function showKickedNotification(kickedBy, okCallback) {
    const template = document.getElementById("kickedNotificationDialog");
    let overlayEl;

    if (template && template.content) {
      const clone = template.content.cloneNode(true);
      document.body.appendChild(clone);
      const modals = document.querySelectorAll(".modal-overlay");
      overlayEl = modals[modals.length - 1];
      const kickerNameEl = overlayEl.querySelector(".kicked-by-name strong");
      if (kickerNameEl) kickerNameEl.textContent = kickedBy;
    } else {
      overlayEl = document.createElement("div");
      overlayEl.className = "modal-overlay";
      overlayEl.innerHTML = `
        <div class="modal-dialog">
          <h2 class="modal-title">Kicked</h2>
          <p>You were kicked by <strong>${_escapeHtml(kickedBy || "Admin")}</strong>.</p>
          <div class="modal-actions">
            <button class="kicked-ok-btn">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlayEl);
    }

    const dialog = overlayEl;
    const okBtn = dialog.querySelector(".kicked-ok-btn");
    okBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      dialog.remove();
      if (typeof okCallback === "function") okCallback();
    });
  }

  // Render player list into container (id or element).
  // options: { currentPlayerId, isAdmin, onKick(playerId), showKickCondition(room, player, index) }
  function renderPlayerList(containerOrId, players = [], options = {}) {
    const container =
      typeof containerOrId === "string"
        ? document.getElementById(containerOrId)
        : containerOrId;
    if (!container) return;

    const template = document.getElementById("playerItem");
    container.innerHTML = "";

    const isAdmin = !!options.isAdmin;

    players.forEach((player, index) => {
      let tile;
      if (template && template.content) {
        const clone = template.content.cloneNode(true);
        tile = clone.querySelector(".playerTile") || clone;
        // If clone doesn't have top-level .playerTile, append clone whole
        if (!tile) {
          container.appendChild(clone);
          return;
        }
      } else {
        // create minimal tile
        const wrap = document.createElement("div");
        wrap.className = "playerTile";
        wrap.innerHTML = `
          <img class="playerAvatar" src="https://placehold.co/100x100?text=${encodeURIComponent(player.name || "P")}" alt="${_escapeHtml(player.name || "Player")}">
          <span class="player-display-name">${_escapeHtml(player.name || "Player")}</span>
          <button class="kick-btn hidden">Kick</button>
        `;
        tile = wrap;
      }

      const avatar = tile.querySelector(".playerAvatar");
      const nameSpan = tile.querySelector(".player-display-name");
      const crown = tile.querySelector(".admin-crown");
      const kickBtn = tile.querySelector(".kick-btn");

      if (avatar) {
        const displayName = _escapeHtml(player.name || "Player");
        avatar.src = `https://placehold.co/100x100?text=${encodeURIComponent(player.name || "P")}`;
        avatar.alt = displayName;
      }

      if (nameSpan) {
        nameSpan.textContent = player.name || "Player";
      }

      if (crown) {
        if (index === 0) crown.classList.remove("hidden");
        else crown.classList.add("hidden");
      }

      // Decide whether to show kick button:
      // If caller provided custom predicate, use it. Otherwise basic logic: if isAdmin && index !== 0
      const shouldShowKick =
        typeof options.showKickCondition === "function"
          ? options.showKickCondition({ room: options.room, player, index })
          : isAdmin && index !== 0 && !options.room?.gameStarted;

      if (kickBtn) {
        if (shouldShowKick) {
          kickBtn.classList.remove("hidden");
          kickBtn.dataset.playerId = player.id || player.playerId || "";
          kickBtn.dataset.playerName = player.name || "";

          kickBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const pid = kickBtn.dataset.playerId;
            if (typeof options.onKick === "function") {
              options.onKick(pid, player);
            }
          });
        } else {
          kickBtn.classList.add("hidden");
        }
      }

      container.appendChild(tile);
    });
  }

  // Small helper to show a notification — prefer UnoUtils.showNotification if present
  function showNotification(message, type = "info") {
    if (typeof UnoUtils !== "undefined" && UnoUtils.showNotification) {
      UnoUtils.showNotification(message, type);
      return;
    }

    // fallback simple notification
    const el = document.createElement("div");
    el.className = `notification ${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 400);
    }, 2000);
  }

  // Public API
  return {
    createCardElement,
    getCardDisplayInfo,
    getCardDataValue,
    renderHand,
    renderTopCard,
    renderOpponents,
    updateColorIndicator,
    showColorPicker,
    showKickConfirmation,
    showKickedNotification,
    renderPlayerList,
    showNotification,
  };
})();
