class RoomManager {
	constructor() {
		this.rooms = new Map();
		this.startCleanupTimer();
	}

	generateRoomCode() {
		let code;
		let attempts = 0;
		const maxAttempts = 100;

		do {
			code = String(Math.floor(Math.random() * 900000) + 100000);
			attempts++;
		} while (this.rooms.has(code) && attempts < maxAttempts);

		if (attempts >= maxAttempts) {
			throw new Error("Failed to generate unique room code");
		}

		return code;
	}

	createRoom(maxPlayers = 4) {
		const code = this.generateRoomCode();
		const now = Date.now();

		const room = {
			code,
			maxPlayers,
			players: [],
			createdAt: now,
			lastActivity: now,
			gameStarted: false,
			gameState: null,
			kickedPlayers: {}, // Track kick counts per player
		};

		this.rooms.set(code, room);

		return room;
	}

	addPlayer(code, playerId, name = "Player") {
		const room = this.rooms.get(code);

		if (!room) {
			return { success: false, error: "Room not found" };
		}

		// Check if player has been kicked twice
		if (room.kickedPlayers[playerId] >= 2) {
			return { success: false, error: "You have been banned from this room" };
		}

		// Check if player already exists (reconnection)
		const existingPlayer = room.players.find((p) => p.id === playerId || p.playerId === playerId);
		if (existingPlayer) {
			existingPlayer.connected = true;
			existingPlayer.name = name;
			room.lastActivity = Date.now();
			return { success: true, room, reconnected: true };
		}

		const playerRoom = this.findPlayerRoom(playerId);
		if (playerRoom && playerRoom.code !== code) {
			return { success: false, error: "Player is already in another room" };
		}

		// Only block new players if game has started
		if (room.gameStarted) {
			return { success: false, error: "Game already in progress" };
		}

		if (room.players.length >= room.maxPlayers) {
			return { success: false, error: "Room is full" };
		}

		room.players.push({
			id: playerId,
			playerId, // Keep for compatibility
			name,
			connected: true,
		});

		room.lastActivity = Date.now();

		return { success: true, room };
	}

	disconnectPlayer(playerId) {
		this.rooms.forEach((room) => {
			const player = room.players.find((p) => p.id === playerId || p.playerId === playerId);
			if (player) {
				player.connected = false;
			}
		});
	}

	reconnectPlayer(playerId) {
		this.rooms.forEach((room) => {
			const player = room.players.find((p) => p.id === playerId || p.playerId === playerId);
			if (player) {
				player.connected = true;
				room.lastActivity = Date.now();
			}
		});
	}

	removePlayer(code, playerId, wasKicked = false) {
		const room = this.rooms.get(code);

		if (!room) {
			return { success: false, error: "Room not found" };
		}

		const index = room.players.findIndex((p) => p.id === playerId || p.playerId === playerId);
		if (index === -1) {
			return { success: false, error: "Player not in room" };
		}

		// Track kick count if player was kicked
		if (wasKicked) {
			room.kickedPlayers[playerId] = (room.kickedPlayers[playerId] || 0) + 1;
		}

		const wasAdmin = index === 0;
		room.players.splice(index, 1);

		room.lastActivity = Date.now();

		return { success: true, room, wasAdmin, newAdmin: room.players.length > 0 ? room.players[0] : null };
	}

	getRoom(code) {
		return this.rooms.get(code);
	}

	findPlayerRoom(playerId) {
		for (const room of this.rooms.values()) {
			if (room.players.some((p) => p.id === playerId || p.playerId === playerId)) {
				return room;
			}
		}
		return null;
	}

	updateActivity(code) {
		const room = this.rooms.get(code);
		if (room) {
			room.lastActivity = Date.now();
		}
	}

	cleanupInactiveRooms() {
		const now = Date.now();
		const oneHour = 60 * 60 * 1000;

		let cleaned = 0;
		this.rooms.forEach((room, code) => {
			if (now - room.lastActivity > oneHour) {
				this.rooms.delete(code);
				cleaned++;
			}
		});
	}

	startCleanupTimer() {
		setInterval(
			() => {
				this.cleanupInactiveRooms();
			},
			10 * 60 * 1000,
		);

		console.log("Room cleanup timer started (runs every 10 minutes)");
	}

	getStats() {
		return {
			totalRooms: this.rooms.size,
			rooms: Array.from(this.rooms.values()).map((room) => ({
				code: room.code,
				players: room.players.length,
				maxPlayers: room.maxPlayers,
				connected: room.players.filter((p) => p.connected).length,
			})),
		};
	}

	// ==================== UNO GAME LOGIC ====================

	createDeck() {
		const colors = ["red", "blue", "green", "yellow"];
		const deck = [];

		// Add number cards (0-9)
		colors.forEach((color) => {
			deck.push({ color, value: 0, type: "number" });
			for (let i = 1; i <= 9; i++) {
				deck.push({ color, value: i, type: "number" });
				deck.push({ color, value: i, type: "number" });
			}
		});

		// Add action cards (Skip, Reverse, Draw Two)
		colors.forEach((color) => {
			for (let i = 0; i < 2; i++) {
				deck.push({ color, value: "skip", type: "skip" });
				deck.push({ color, value: "reverse", type: "reverse" });
				deck.push({ color, value: "draw2", type: "draw2" });
			}
		});

		// Add Wild cards
		for (let i = 0; i < 4; i++) {
			deck.push({ color: "wild", value: "wild", type: "wild" });
			deck.push({ color: "wild", value: "wild4", type: "wild4" });
		}

		return this.shuffleDeck(deck);
	}

	shuffleDeck(deck) {
		const shuffled = [...deck];
		// Use Fisher-Yates shuffle with multiple passes for better randomization
		for (let pass = 0; pass < 3; pass++) {
			for (let i = shuffled.length - 1; i > 0; i--) {
				// Use crypto random if available, otherwise Math.random
				const j = Math.floor(Math.random() * (i + 1));
				[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
			}
		}
		return shuffled;
	}

	startGame(code, requestingPlayerId) {
		const room = this.rooms.get(code);

		if (!room) {
			return { success: false, error: "Room not found" };
		}

		if (room.gameStarted) {
			return { success: false, error: "Game already started" };
		}

		if (room.players.length < 2) {
			return { success: false, error: "Need at least 2 players to start" };
		}

		const adminId = room.players[0]?.id || room.players[0]?.playerId;
		if (!requestingPlayerId || adminId !== requestingPlayerId) {
			return { success: false, error: "Only the room admin can start the game" };
		}

		// Initialize deck and deal cards
		const deck = this.createDeck();
		const discardPile = [];

		// Deal 7 cards to each player
		const playerHands = {};
		room.players.forEach((player) => {
			const playerId = player.id || player.playerId;
			playerHands[playerId] = [];
			for (let i = 0; i < 7; i++) {
				playerHands[playerId].push(deck.pop());
			}
		});

		// Place first card in discard pile (ensure it's not a wild or action card)
		let firstCard;
		do {
			firstCard = deck.pop();
		} while (
			firstCard.color === "wild" ||
			firstCard.type === "skip" ||
			firstCard.type === "reverse" ||
			firstCard.type === "draw2"
		);
		discardPile.push(firstCard);

		// Initialize game state
		room.gameState = {
			deck,
			discardPile,
			playerHands,
			currentPlayerIndex: 0,
			direction: 1, // 1 for clockwise, -1 for counter-clockwise
			currentColor: firstCard.color,
			drawCount: 0, // For stacking Draw 2/Wild Draw 4 cards
			hasDrawnThisTurn: false, // Track if player has drawn voluntarily this turn
		};

		room.gameStarted = true;
		room.lastActivity = Date.now();

		console.log(`Game started in room ${code}`);

		return {
			success: true,
			gameState: this.getPublicGameState(room),
		};
	}

	getPublicGameState(room) {
		if (!room.gameState) return null;

		const {
			deck,
			discardPile,
			playerHands,
			currentPlayerIndex,
			direction,
			currentColor,
			drawCount,
			hasDrawnThisTurn,
		} = room.gameState;

		// Create player info without revealing cards
		const players = room.players.map((player, index) => ({
			playerId: player.id || player.playerId,
			name: player.name,
			cardCount: playerHands[player.id || player.playerId]?.length || 0,
			isCurrentPlayer: index === currentPlayerIndex,
		}));

		return {
			topCard: discardPile[discardPile.length - 1],
			currentPlayerId: room.players[currentPlayerIndex]?.id || room.players[currentPlayerIndex]?.playerId,
			players,
			direction,
			currentColor,
			drawCount,
			hasDrawnThisTurn,
			deckCount: deck.length,
			playerHands, // Will be filtered per-player by socket handler
		};
	}

	canPlayCard(card, topCard, currentColor) {
		// Wild cards can always be played
		if (card.color === "wild") {
			return true;
		}

		// Match color
		if (card.color === currentColor) {
			return true;
		}

		// Match value (works for both number and action cards)
		if (card.value === topCard.value) {
			return true;
		}

		return false;
	}

	playCard(code, playerId, cardIndex, chosenColor = null) {
		const room = this.rooms.get(code);

		if (!room) {
			return { success: false, error: "Room not found" };
		}

		if (!room.gameStarted) {
			return { success: false, error: "Game not started" };
		}

		const { gameState } = room;
		const currentPlayer = room.players[gameState.currentPlayerIndex];
		const currentPlayerId = currentPlayer.id || currentPlayer.playerId;

		if (currentPlayerId !== playerId) {
			return { success: false, error: "Not your turn" };
		}

		const playerHand = gameState.playerHands[playerId];
		if (!playerHand || cardIndex < 0 || cardIndex >= playerHand.length) {
			return { success: false, error: "Invalid card index" };
		}

		const card = playerHand[cardIndex];
		const topCard = gameState.discardPile[gameState.discardPile.length - 1];

		// Check if player must draw cards first
		if (gameState.drawCount > 0) {
			const canStack =
				(card.type === "draw2" && topCard.type === "draw2") ||
				(card.type === "wild4" && topCard.type === "wild4");

			if (!canStack) {
				return {
					success: false,
					error: `Must draw ${gameState.drawCount} cards first`,
				};
			}
		}

		// Validate card can be played
		if (!this.canPlayCard(card, topCard, gameState.currentColor)) {
			return { success: false, error: "Card cannot be played" };
		}

		// Remove card from player's hand
		playerHand.splice(cardIndex, 1);
		gameState.discardPile.push(card);

		// Handle card effects
		this.handleCardEffect(room, card, chosenColor);

		// Check for winner
		if (playerHand.length === 0) {
			room.gameStarted = false;
			console.log(`Player ${playerId} won the game in room ${code}`);
			return {
				success: true,
				gameState: this.getPublicGameState(room),
				winner: playerId,
			};
		}

		room.lastActivity = Date.now();

		return {
			success: true,
			gameState: this.getPublicGameState(room),
		};
	}

	handleCardEffect(room, card, chosenColor) {
		const { gameState } = room;

		if (card.color && card.color !== "wild") {
			gameState.currentColor = card.color;
		}

		switch (card.type) {
			case "skip":
				this.nextTurn(room);
				break;

			case "reverse":
				gameState.direction *= -1;
				// In 2-player game, reverse acts like skip
				if (room.players.length === 2) {
					this.nextTurn(room);
				}
				break;

			case "draw2":
				gameState.drawCount += 2;
				break;

			case "wild":
				gameState.currentColor = chosenColor || "red";
				break;

			case "wild4":
				gameState.currentColor = chosenColor || "red";
				gameState.drawCount += 4;
				break;

			default:
				break;
		}

		// Move to next player
		this.nextTurn(room);
	}

	nextTurn(room) {
		const { gameState } = room;
		const playerCount = room.players.length;

		gameState.currentPlayerIndex =
			(gameState.currentPlayerIndex + gameState.direction + playerCount) %
			playerCount;

		// Reset hasDrawnThisTurn flag for the new turn
		gameState.hasDrawnThisTurn = false;
	}

	drawCard(code, playerId) {
		const room = this.rooms.get(code);

		if (!room) {
			return { success: false, error: "Room not found" };
		}

		if (!room.gameStarted) {
			return { success: false, error: "Game not started" };
		}

		const { gameState } = room;
		const currentPlayer = room.players[gameState.currentPlayerIndex];
		const currentPlayerId = currentPlayer.id || currentPlayer.playerId;

		if (currentPlayerId !== playerId) {
			return { success: false, error: "Not your turn" };
		}

		const playerHand = gameState.playerHands[playerId];
		const isPenaltyDraw = gameState.drawCount > 0;

		// Prevent multiple voluntary draws in same turn
		if (!isPenaltyDraw && gameState.hasDrawnThisTurn) {
			return { success: false, error: "You have already drawn this turn" };
		}

		const drawAmount = isPenaltyDraw ? gameState.drawCount : 1;

		// Reshuffle discard pile if deck is empty
		if (gameState.deck.length < drawAmount) {
			const topCard = gameState.discardPile.pop();
			gameState.deck = this.shuffleDeck(gameState.discardPile);
			gameState.discardPile = [topCard];
		}

		// Draw cards
		const drawnCards = [];
		for (let i = 0; i < drawAmount; i++) {
			if (gameState.deck.length > 0) {
				const card = gameState.deck.pop();
				playerHand.push(card);
				drawnCards.push(card);
			}
		}

		// If penalty draw, reset count and skip turn
		if (isPenaltyDraw) {
			gameState.drawCount = 0;
			this.nextTurn(room);
		} else {
			// Voluntary draw - mark that player has drawn
			gameState.hasDrawnThisTurn = true;

			// Check if player can play any card after drawing
			const topCard = gameState.discardPile[gameState.discardPile.length - 1];
			const hasPlayableCard = playerHand.some(card => this.canPlayCard(card, topCard, gameState.currentColor));

			// If no playable cards, auto-skip turn
			if (!hasPlayableCard) {
				this.nextTurn(room);
			}
		}

		room.lastActivity = Date.now();

		return {
			success: true,
			gameState: this.getPublicGameState(room),
			drawnCards: drawnCards,
			isPenaltyDraw: isPenaltyDraw,
		};
	}
}

module.exports = RoomManager;
