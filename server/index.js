require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const requiredEnvVars = ['RPC_URL', 'OPERATOR_PRIVATE_KEY', 'PLAY_GAME_CONTRACT_ADDRESS'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing environment variable: ${envVar}`);
        process.exit(1);
    }
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

let playGameAbi;
try {
  playGameAbi = require(path.resolve(__dirname, '../artifacts/contracts/PlayGame.sol/PlayGame.json')).abi;
} catch (err) {
  console.error('Failed to load contract ABI:', err);
  process.exit(1);
}

const playGameContract = new ethers.Contract(
  process.env.PLAY_GAME_CONTRACT_ADDRESS,
  playGameAbi,
  wallet
);

const queue = {};
const connectedWallets = new Map();
const activeMatches = new Map();

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error("Wallet address required"));
    }
    socket.userAddress = token.toLowerCase();
    next();
});

io.on('connection', (socket) => {
    const address = socket.userAddress;
    console.log(`New connection: ${socket.id} (${address})`);

    if (connectedWallets.has(address)) {
        const existingSocketId = connectedWallets.get(address);
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
            existingSocket.emit('error', { error: "New connection detected, disconnecting old one." });
            existingSocket.disconnect(true);
        }
    }
    connectedWallets.set(address, socket.id);

    socket.on('joinQueue', async ({ stake }) => {
        try {
            if (!stake || isNaN(stake)) return;
            for (const stakeAmount in queue) {
                queue[stakeAmount] = queue[stakeAmount].filter(p => p.address !== address);
            }

            if (queue[stake]?.length > 0) {
                const player1 = queue[stake].shift();
                const player2 = { address, socketId: socket.id };
                const matchId = ethers.id(uuidv4());

                console.log(`Match found: ${player1.address} vs ${player2.address}. Creating on-chain...`);
                
                try {
                    const stakeAmount = ethers.parseUnits(stake.toString(), 18);
                    const tx = await playGameContract.createMatch(matchId, player1.address, player2.address, stakeAmount);
                    await tx.wait();
                    console.log(`On-chain match created: ${tx.hash}.`);
                    
                    const match = {
                        id: matchId,
                        players: {
                            [player1.address]: { socketId: player1.socketId, staked: false },
                            [player2.address]: { socketId: player2.socketId, staked: false }
                        },
                        stakeAmount: stake
                    };
                    activeMatches.set(matchId, match);

                    io.to(player1.socketId).emit('matchFound', { opponent: player2.address, matchId, role: 'p1', stake });
                    socket.emit('matchFound', { opponent: player1.address, matchId, role: 'p2', stake });
                } catch (onChainError) {
                    console.error('On-chain match creation failed:', onChainError);
                    queue[stake].unshift(player1);
                }
            } else {
                queue[stake] = queue[stake] || [];
                queue[stake].push({ address, socketId: socket.id });
                console.log(`Player queued: ${address} (Stake: ${stake})`);
            }
        } catch (err) {
            console.error('Queue error:', err);
        }
    });

    socket.on('stakingComplete', async ({ matchId }) => {
        const match = activeMatches.get(matchId);
        if (!match) return;

        try {
            const matchInfo = await playGameContract.matches(matchId);
            const isP1 = address === Object.keys(match.players)[0];
            const hasStaked = isP1 ? matchInfo.p1_staked : matchInfo.p2_staked;

            if (!hasStaked) {
                throw new Error("On-chain staking not confirmed");
            }

            match.players[address].staked = true;
            console.log(`Player ${address} staked verified for match ${matchId}`);

            const bothStaked = Object.values(match.players).every(p => p.staked);
            if (bothStaked) {
                console.log(`Both players staked for match ${matchId}. Starting game.`);
                Object.values(match.players).forEach(player => {
                    io.to(player.socketId).emit('gameReady', { matchId });
                });
            }
        } catch (error) {
            console.error(`Staking verification failed for ${address}:`, error);
            socket.emit('stakingError', { error: "Staking verification failed" });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id} (${address})`);
        connectedWallets.delete(address);
        for (const stake in queue) {
            queue[stake] = queue[stake].filter(p => p.socketId !== socket.id);
        }
    });
});

app.post('/match/result', async (req, res) => {
    try {
        const { matchId, winner } = req.body;
        if (!matchId || !winner) {
            return res.status(400).json({ error: 'Missing matchId or winner' });
        }
        const tx = await playGameContract.commitResult(matchId, winner);
        await tx.wait();
        console.log(`Result submitted: ${tx.hash}`);
        activeMatches.delete(matchId);
        return res.json({ success: true, txHash: tx.hash });
    } catch (error) {
        console.error('Result submission failed:', error);
        return res.status(500).json({ error: error.reason || 'Transaction failed' });
    }
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});