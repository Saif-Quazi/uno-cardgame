const Home = (() => {
  "use strict";

  function startGameInPlace(formattedCode) {
    const target = `/?code=${formattedCode}`;
    if (window.location.search !== `?code=${formattedCode}`) {
      window.history.pushState({}, "", target);
    }

    if (typeof window.Game !== "undefined" && typeof window.Game.init === "function") {
      window.Game.init();
      return;
    }

    if (typeof UnoUtils !== "undefined" && UnoUtils.showNotification) {
      UnoUtils.showNotification(
        "Unable to start game UI in-place. Please refresh and try again.",
        "error",
      );
    }
  }

  async function createRoom(maxPlayers) {
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPlayers }),
      });

      if (!response.ok) throw new Error("Failed to create room");

      const data = await response.json();
      const code = data.code || "";
      const formatted =
        typeof Validate !== "undefined" && Validate.formatRoomCode
          ? Validate.formatRoomCode(code)
          : typeof UnoUtils !== "undefined" && UnoUtils.formatRoomCode
            ? UnoUtils.formatRoomCode(code)
            : code;
      startGameInPlace(formatted);
    } catch (error) {
      console.error("Error creating room:", error);
      if (typeof UnoUtils !== "undefined" && UnoUtils.showNotification) {
        UnoUtils.showNotification(
          "Failed to create room. Please try again.",
          "error",
        );
      } else {
        alert("Failed to create room. Please try again.");
      }
    }
  }

  function showCreateRoomDialog() {
    const template = document.getElementById("createRoomDialog");
    if (!template) {
      console.error("createRoomDialog template not found");
      return;
    }

    const clone = template.content.cloneNode(true);
    const dialog = clone.querySelector(".modal-overlay");
    if (!dialog) return;

    document.body.appendChild(clone);
    setupCreateRoomHandlers(dialog);
  }

  function setupPlayerCountSelection(dialog) {
    let selectedCount = 4;
    const buttons = dialog.querySelectorAll(".player-count-btn");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedCount = parseInt(btn.dataset.count, 10) || 4;
      });
    });

    return () => selectedCount;
  }

  function setupCreateRoomHandlers(dialog) {
    const getSelectedCount = setupPlayerCountSelection(dialog);

    const createBtn = dialog.querySelector(".create-btn");
    const cancelBtn = dialog.querySelector(".cancel-btn");

    createBtn?.addEventListener("click", () => {
      dialog.remove();
      createRoom(getSelectedCount());
    });

    cancelBtn?.addEventListener("click", () => dialog.remove());

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  function showJoinRoomDialog() {
    const template = document.getElementById("joinRoomDialog");
    if (!template) {
      console.error("joinRoomDialog template not found");
      return;
    }

    const clone = template.content.cloneNode(true);
    const dialog = clone.querySelector(".modal-overlay");
    if (!dialog) return;

    document.body.appendChild(clone);

    setupJoinRoomHandlers(dialog);
  }

  function setupJoinRoomHandlers(dialog) {
    const input = dialog.querySelector(".room-code-input");
    if (!input) return;

    input.addEventListener("input", (e) => {
      const val = e.target.value || "";
      if (typeof Validate !== "undefined" && Validate.formatRoomCodeInput) {
        e.target.value = Validate.formatRoomCodeInput(val);
      } else if (
        typeof UnoUtils !== "undefined" &&
        UnoUtils.formatRoomCodeInput
      ) {
        e.target.value = UnoUtils.formatRoomCodeInput(val);
      } else {
        e.target.value = val.replace(/[^0-9-]/g, "");
      }
    });

    const handleJoin = () => {
      const code = input.value.trim();
      const isValid =
        typeof Validate !== "undefined" && Validate.isValidRoomCode
          ? Validate.isValidRoomCode(code)
          : typeof UnoUtils !== "undefined" && UnoUtils.isValidRoomCode
            ? UnoUtils.isValidRoomCode(code)
            : /^\d{3}-?\d{3}$/.test(code);

      if (isValid) {
        const cleanCode = code.replace(/-/g, "");
        dialog.remove();
        const formatted =
          typeof Validate !== "undefined" && Validate.formatRoomCode
            ? Validate.formatRoomCode(cleanCode)
            : typeof UnoUtils !== "undefined" && UnoUtils.formatRoomCode
              ? UnoUtils.formatRoomCode(cleanCode)
              : cleanCode;
        startGameInPlace(formatted);
      } else {
        if (typeof UnoUtils !== "undefined" && UnoUtils.shakeElement) {
          UnoUtils.shakeElement(input);
        } else {
          input.classList.add("shake");
          setTimeout(() => input.classList.remove("shake"), 500);
        }

        if (typeof UnoUtils !== "undefined" && UnoUtils.showNotification) {
          UnoUtils.showNotification(
            "Invalid room code. Use a 6-digit code (e.g. 123-456).",
            "error",
          );
        }
      }
    };

    dialog.querySelector(".join-btn")?.addEventListener("click", handleJoin);
    dialog
      .querySelector(".cancel-btn")
      ?.addEventListener("click", () => dialog.remove());

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleJoin();
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.remove();
    });

    input.focus();
  }

  function renderShowcaseCards() {
    // Render the small showcase fan on the homepage.
    // Prefer using UnoUI.createCardElement (if present) for consistent visuals.
    // Fall back to a lightweight inline SVG builder that uses Utils.escapeHtml when available.
    const fanCards = document.querySelectorAll(".fan-card");
    if (!fanCards || fanCards.length === 0) return;

    const colorMap = {
      red: "#e53935",
      blue: "#1e88e5",
      green: "#43a047",
      yellow: "#fdd835",
      wild: "#ffffff",
    };

    // escape helper: prefer Utils.escapeHtml, then UnoUtils, finally a raw string fallback
    const esc =
      (typeof Utils !== "undefined" && Utils.escapeHtml) ||
      (typeof UnoUtils !== "undefined" && UnoUtils.escapeHtml) ||
      ((s) => String(s));

    fanCards.forEach((cardEl) => {
      const color = (cardEl.dataset.color || "").toLowerCase();
      const valueRaw = cardEl.dataset.value;
      const type = (cardEl.dataset.type || "").toLowerCase();

      if (!valueRaw && valueRaw !== 0) return;

      const value = isNaN(valueRaw) ? valueRaw : parseInt(valueRaw, 10);
      const cardObj = { color, value, type };

      // Prefer UnoUI.createCardElement if available
      if (
        typeof UnoUI !== "undefined" &&
        typeof UnoUI.createCardElement === "function"
      ) {
        try {
          const created = UnoUI.createCardElement(cardObj);
          if (created instanceof Node) {
            // ensure the fan-card class remains for layout
            created.classList.add("fan-card");
            cardEl.replaceWith(created);
            return;
          } else if (created && created.innerHTML !== undefined) {
            const wrapper = document.createElement("div");
            wrapper.className = "card fan-card";
            wrapper.appendChild(created);
            cardEl.replaceWith(wrapper);
            return;
          }
        } catch (err) {
          console.warn(
            "UnoUI.createCardElement failed, falling back to inline:",
            err,
          );
        }
      }

      // Fallback inline SVG builder (kept simple and reliable)
      const bgColor = colorMap[color] || "#ffffff";
      const borderColor = color === "wild" ? "#222" : "#fff";
      const textColor = color === "yellow" ? "#000" : "#fff";
      const display = type === "number" ? value : String(value);

      function cornerText(text, size = 16) {
        return `<text x="18" y="28" font-family="Poppins, Arial, sans-serif" font-size="${size}" font-weight="700" fill="${textColor}">${esc(String(text))}</text>`;
      }

      function bottomCornerText(text, size = 16) {
        return `<g transform="translate(100,155) rotate(180)">${cornerText(text, size)}</g>`;
      }

      let svg = "";
      svg += `<svg viewBox="0 0 100 155" xmlns="http://www.w3.org/2000/svg" class="card-svg" role="img" aria-label="${esc(String(valueRaw))}">`;
      svg += `<defs><linearGradient id="g${Date.now()}${Math.random().toString(36).slice(2, 6)}" x1="0%" y1="0%" x2="100%" y2="100%">`;

      const gradStops =
        color === "red"
          ? '<stop offset="0%" style="stop-color:#ff3030"/><stop offset="100%" style="stop-color:#d72600"/>'
          : color === "blue"
            ? '<stop offset="0%" style="stop-color:#3d8cff"/><stop offset="100%" style="stop-color:#0956bf"/>'
            : color === "green"
              ? '<stop offset="0%" style="stop-color:#4cb848"/><stop offset="100%" style="stop-color:#379711"/>'
              : color === "yellow"
                ? '<stop offset="0%" style="stop-color:#ffeb3b"/><stop offset="100%" style="stop-color:#ecd407"/>'
                : color === "wild"
                  ? '<stop offset="0%" style="stop-color:#d72600"/><stop offset="25%" style="stop-color:#0956bf"/><stop offset="50%" style="stop-color:#379711"/><stop offset="75%" style="stop-color:#ecd407"/><stop offset="100%" style="stop-color:#d72600"/>'
                  : '<stop offset="0%" style="stop-color:#ddd"/><stop offset="100%" style="stop-color:#bbb"/>';

      svg += gradStops;
      svg += `</linearGradient></defs>`;

      const gradientId = `g${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      const bgFill = color === "wild" ? "#222" : `url(#${gradientId})`;

      // Use the previously added gradient id consistently
      // (add rect using the dynamic id as fallback - browsers ignore if id mismatch)
      svg = svg.replace(/id="g[0-9]*[a-z0-9]*"/, `id="${gradientId}"`);
      svg += `<rect x="2" y="2" width="96" height="151" rx="12" ry="12" fill="${bgFill}" stroke="${borderColor}" stroke-width="2"/>`;
      svg += `<ellipse cx="50" cy="77.5" rx="34" ry="52" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="3" transform="rotate(35 50 77.5)"/>`;

      if (type === "number") {
        svg += `<g class="corner-top">${cornerText(display, 16)}</g>`;
        svg += `<g class="center-text"><text x="50" y="90" font-family="Poppins, Arial, sans-serif" font-size="36" font-weight="800" text-anchor="middle" fill="${textColor}">${esc(String(display))}</text></g>`;
        svg += `<g class="corner-bottom">${bottomCornerText(display, 16)}</g>`;
      } else if (type === "draw2") {
        svg += `<g class="corner-top">${cornerText("+2", 14)}</g>`;
        svg += `<g class="center-text"><text x="50" y="90" font-family="Poppins, Arial, sans-serif" font-size="36" font-weight="800" text-anchor="middle" fill="${textColor}">+2</text></g>`;
        svg += `<g class="corner-bottom">${bottomCornerText("+2", 14)}</g>`;
      } else if (type === "skip") {
        svg += `<g class="corner-top">${cornerText("✕", 16)}</g>`;
        svg += `<foreignObject x="30" y="50" width="40" height="40"><body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background:transparent;"><div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:${textColor};"><i class="fa-solid fa-ban" style="font-size:28px;line-height:1"></i></div></body></foreignObject>`;
        svg += `<g class="corner-bottom">${bottomCornerText("✕", 16)}</g>`;
      } else if (type === "reverse") {
        svg += `<g class="corner-top">${cornerText("↺", 16)}</g>`;
        svg += `<foreignObject x="30" y="52" width="40" height="40"><body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background:transparent;"><div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;color:${textColor};"><i class="fa-solid fa-arrows-rotate" style="font-size:26px;line-height:1"></i></div></body></foreignObject>`;
        svg += `<g class="corner-bottom">${bottomCornerText("↺", 16)}</g>`;
      } else if (
        color === "wild" ||
        String(valueRaw).toLowerCase().includes("wild")
      ) {
        svg += `<ellipse cx="50" cy="77.5" rx="28" ry="40" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="2" transform="rotate(35 50 77.5)"/>`;
        const quarter = [
          { cx: 36, cy: 65, fill: "#e53935" },
          { cx: 64, cy: 65, fill: "#1e88e5" },
          { cx: 36, cy: 90, fill: "#43a047" },
          { cx: 64, cy: 90, fill: "#fdd835" },
        ];
        quarter.forEach((q) => {
          svg += `<circle cx="${q.cx}" cy="${q.cy}" r="9" fill="${q.fill}" stroke="#222" stroke-width="0.5" />`;
        });
        svg += `<ellipse cx="18" cy="28" rx="7" ry="9" fill="#e53935" stroke="#222" stroke-width="0.6" />`;
        svg += `<g transform="translate(100,155) rotate(180)"><ellipse cx="18" cy="28" rx="7" ry="9" fill="#e53935" stroke="#222" stroke-width="0.6" /></g>`;
        if (
          String(valueRaw).toLowerCase() === "wild4" ||
          String(valueRaw) === "+4"
        ) {
          svg += `<g class="center-text"><text x="50" y="88" font-family="Poppins, Arial, sans-serif" font-size="32" font-weight="800" text-anchor="middle" fill="#fff">+4</text></g>`;
        } else {
          svg += `<g class="center-text"><text x="50" y="88" font-family="Poppins, Arial, sans-serif" font-size="32" font-weight="800" text-anchor="middle" fill="#fff">W</text></g>`;
        }
      } else {
        svg += `<g class="corner-top">${cornerText(display, 16)}</g>`;
        svg += `<g class="center-text"><text x="50" y="90" font-family="Poppins, Arial, sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="${textColor}">${esc(String(display))}</text></g>`;
        svg += `<g class="corner-bottom">${bottomCornerText(display, 16)}</g>`;
      }

      svg += `</svg>`;

      // Insert built markup
      cardEl.innerHTML = svg;
    });
  }

  function init() {
    const createBtn =
      document.getElementById("createGameBtn") ||
      document.querySelector(".playBtns:nth-child(1)");
    const joinBtn =
      document.getElementById("joinGameBtn") ||
      document.querySelector(".playBtns:nth-child(2)");
    const settingsIcon = document.getElementById("settingsIcon");

    createBtn?.addEventListener("click", () => showCreateRoomDialog());
    joinBtn?.addEventListener("click", () => showJoinRoomDialog());

    settingsIcon?.addEventListener("click", () => {
      if (typeof UnoUtils !== "undefined" && UnoUtils.showSettingsDialog) {
        UnoUtils.showSettingsDialog((settings) => {
          if (typeof UnoUtils.showNotification === "function") {
            UnoUtils.showNotification("Settings saved!", "success");
          }
        });
      }
    });

    renderShowcaseCards();

    const existingName =
      typeof UnoUtils !== "undefined" && UnoUtils.getPlayerName
        ? UnoUtils.getPlayerName()
        : localStorage.getItem("playerName");

    if (!existingName) {
      setTimeout(() => {
        if (typeof UnoUtils !== "undefined" && UnoUtils.showNamePrompt) {
          UnoUtils.showNamePrompt((name) => {});
        }
      }, 500);
    }
  }

  return {
    createRoom,
    showCreateRoomDialog,
    showJoinRoomDialog,
    init,
  };
})();

if (typeof window !== "undefined") window.Home = Home;
