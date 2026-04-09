const Home = (() => {
  "use strict";

  function startGameInPlace(formattedCode) {
    const target = `/?code=${formattedCode}`;
    if (window.location.search !== `?code=${formattedCode}`) {
      window.history.pushState({}, "", target);
    }

    if (
      typeof window.Game !== "undefined" &&
      typeof window.Game.init === "function"
    ) {
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
    const fanCards = document.querySelectorAll(".fan-card");
    if (!fanCards || fanCards.length === 0) return;

    fanCards.forEach((cardEl) => {
      const color = (cardEl.dataset.color || "").toLowerCase();
      const valueRaw = cardEl.dataset.value;
      const type = (cardEl.dataset.type || "").toLowerCase();

      if (!valueRaw && valueRaw !== 0) return;

      const value = isNaN(valueRaw) ? valueRaw : parseInt(valueRaw, 10);
      const cardObj = { color, value, type };

      if (
        typeof UnoUI !== "undefined" &&
        typeof UnoUI.createCardElement === "function"
      ) {
        try {
          const created = UnoUI.createCardElement(cardObj);
          if (created instanceof Node) {
            created.classList.add("fan-card");
            cardEl.replaceWith(created);
            return;
          }
        } catch (err) {
          console.warn("UnoUI.createCardElement failed:", err);
        }
      }
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
        UnoUtils.showSettingsDialog((_settings) => {
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
          UnoUtils.showNamePrompt((_name) => {});
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
