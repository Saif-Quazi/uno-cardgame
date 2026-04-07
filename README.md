
# UNO Multiplayer Game

A simple real-time multiplayer UNO card game built with Express, Socket.IO, and vanilla JavaScript.

## Features
- Real-time multiplayer gameplay (2-4 players)
- Stable player connections (reconnect after refresh)
- Easy room creation and joining
- Simple in-memory room storage

## Project Structure

```
UnoGame/
├── server.js         # Main server entry point
├── server/           # Backend logic (rooms, HTTP, sockets)
├── public/           # Static files (HTML, JS, CSS, assets)
└── package.json      # Project manifest
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
- Rooms are cleaned up after 1 hour of inactivity

## License

MIT

---

Built with Express, Socket.IO, and vanilla JavaScript