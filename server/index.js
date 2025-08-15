require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path'); // <-- ADD THIS LINE

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const privateKey = process.env.OPERATOR_PRIVATE_KEY;
const wallet = new ethers.Wallet(privateKey, provider);
const playGameAddress = process.env.PLAY_GAME_CONTRACT_ADDRESS;

// --- CORRECTED FILE PATH ---
const abiPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'PlayGame.sol', 'PlayGame.json');
const playGameAbi = require(abiPath).abi;
// --- END CORRECTION ---

const playGameContract = new ethers.Contract(playGameAddress, playGameAbi, wallet);

const queue = {};

app.post('/match/start', async (req, res) => {
    const { matchId, p1, p2, stake } = req.body;
    try {
        console.log(`Creating match ${matchId}...`);
        const stakeAmount = ethers.parseUnits(stake.toString(), 18);
        const tx = await playGameContract.createMatch(matchId, p1, p2, stakeAmount);
        await tx.wait();
        console.log(`Match ${matchId} created successfully! Tx: ${tx.hash}`);
        res.status(200).json({ message: 'Match created successfully', txHash: tx.hash });
    } catch (error) {
        console.error('Error creating match:', error);
        res.status(500).json({ error: 'Failed to create match' });
    }
});

app.post('/match/result', async (req, res) => {
    const { matchId, winner } = req.body;
    try {
        console.log(`Submitting result for match ${matchId}...`);
        const tx = await playGameContract.commitResult(matchId, winner);
        await tx.wait();
        console.log(`Result for ${matchId} submitted! Winner: ${winner}. Tx: ${tx.hash}`);
        res.status(200).json({ message: 'Result submitted successfully', txHash: tx.hash });
    } catch (error) {
        console.error('Error submitting result:', error);
        res.status(500).json({ error: 'Failed to submit result' });
    }
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('joinQueue', ({ address, stake }) => {
        console.log(`Player ${address} wants to join queue with stake ${stake}`);
        if (queue[stake] && queue[stake].length > 0) {
            const player1 = queue[stake].shift();
            const player2 = { address, socketId: socket.id };
            const matchId = uuidv4();

            console.log(`Match found for stake ${stake}: ${player1.address} vs ${player2.address}`);

            io.to(player1.socketId).emit('matchFound', { opponent: player2.address, matchId, role: 'p1' });
            io.to(player2.socketId).emit('matchFound', { opponent: player1.address, matchId, role: 'p2' });
        } else {
            if (!queue[stake]) {
                queue[stake] = [];
            }
            queue[stake].push({ address, socketId: socket.id });
            console.log(`Player ${address} added to queue for stake ${stake}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
    console.log(`Unified server listening on port ${port}`);
});