(function () {
  "use strict";

  function whenReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function safeInitModule(name) {
    try {
      const mod = window[name];
      if (!mod || typeof mod.init !== "function") {
        console.warn(
          `Module "${name}" not available or missing an init() method.`,
        );
        return false;
      }
      mod.init();
      return true;
    } catch (err) {
      console.error(`Error initializing module "${name}":`, err);
      return false;
    }
  }

  function autoInit() {
    if (typeof Validate === "undefined") {
      console.warn(
        "Validate module is not present. This orchestrator assumes Validate is available.",
      );
    }

    const path = window.location.pathname || "";
    const params = new URLSearchParams(window.location.search);
    const hasRoomCode = !!params.get("code");

    if (path === "/" || path.endsWith("index.html")) {
      if (hasRoomCode) {
        if (safeInitModule("Game")) return;
      }

      if (safeInitModule("Home")) return;

      safeInitModule("HomePage");
      return;
    }

    if (path.endsWith("game.html")) {
      if (safeInitModule("Game")) return;
      safeInitModule("GamePage");
      return;
    }
  }

  whenReady(autoInit);
})();
