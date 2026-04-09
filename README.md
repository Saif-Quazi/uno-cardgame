# UNO Multiplayer Game

A real-time multiplayer UNO card game built with Express, Socket.IO, and vanilla JavaScript.

## Features

- Real-time multiplayer gameplay (2-4 players)
- Stable player connections (reconnect after refresh)
- Easy room creation and joining
- Simple in-memory room storage

## Tech Stack

- Backend: Node.js + Express
- Real-time transport: Socket.IO (event-based, built on WebSocket with fallback transports)
- Frontend: Vanilla JavaScript (plain browser scripts, no React/Vue/Angular)

## Project Structure

```
UnoGame/
├── server.js           # Main server entry point
├── server/             # Backend logic (rooms, HTTP, sockets)
├── public/             # Static files (HTML, JS, CSS, assets)
│   ├── client/         # Browser-side modules
│   ├── styles/         # Page styles
│   └── assets/         # Images and card art
├── smokeTest.js        # Smoke test runner
├── package.json        # Project manifest
├── package-lock.json   # Locked dependency tree
└── .gitignore          # Ignored files
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm run dev
   ```
   Visit [http://localhost:8080](http://localhost:8080)

## How It Works

- Create or join a room from the homepage
- Play UNO with friends in real time
- Inactive rooms are removed after 1 hour (cleanup task runs every 10 minutes)

## License

Not specified in the repository.

---

Built with Express, Socket.IO, and vanilla JavaScript.
