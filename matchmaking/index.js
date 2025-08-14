const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors()); // Enable CORS for frontend requests
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow requests from any origin
    }
});

// This is our simple, in-memory queue for waiting players.
// In a real production system, this would be a database like Redis.
const queue = {};
// Example structure: { "10": [{address: "0x...", socketId: "..."}], "20": [] }

app.get('/', (req, res) => {
    res.send('Matchmaking server is running.');
});

// This is the endpoint the game will call when a player wants to find a match.
app.post('/join-queue', express.json(), (req, res) => {
    const { address, stake, socketId } = req.body;
    console.log(`Player ${address} with socketId ${socketId} wants to join queue with stake ${stake}`);

    // Check if a player is already waiting at this stake level
    if (queue[stake] && queue[stake].length > 0) {
        // Match found!
        const player1 = queue[stake].shift(); // Remove the waiting player from the queue
        const player2 = { address, socketId };

        console.log(`Match found for stake ${stake}: ${player1.address} vs ${player2.address}`);

        // Here you would call your Round 1 API to create the match on-chain.
        // For example:
        // const matchId = ethers.id(`${player1.address}-${player2.address}-${Date.now()}`);
        // fetch('http://localhost:3000/match/start', { 
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ matchId, p1: player1.address, p2: player2.address, stake })
        // });

        // Notify both players via Socket.IO that a match is found.
        // The frontend will listen for this "matchFound" event.
        io.to(player1.socketId).emit("matchFound", { opponent: player2.address, startsAs: "X" });
        io.to(player2.socketId).emit("matchFound", { opponent: player1.address, startsAs: "O" });

        res.status(200).json({ status: 'matched', opponent: player1.address });

    } else {
        // No match found, add player to the queue
        if (!queue[stake]) {
            queue[stake] = [];
        }
        queue[stake].push({ address, socketId });
        
        console.log(`Player ${address} added to queue for stake ${stake}`);
        res.status(200).json({ status: 'queued' });
    }
});

io.on('connection', (socket) => {
    console.log('A user connected with socket ID:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Here you would add logic to remove a player from the queue if they disconnect.
    });
});

const port = 8000; // Use a different port than your Round 1 API
server.listen(port, () => {
    console.log(`Matchmaking server listening on port ${port}`);
});