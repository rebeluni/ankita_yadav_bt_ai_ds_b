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
    methods: ["GET", "POST"],
    credentials: true
  }
});

const requiredEnvVars = ['RPC_URL', 'OPERATOR_PRIVATE_KEY', 'PLAY_GAME_CONTRACT_ADDRESS'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) throw new Error(`Missing environment variable: ${envVar}`);
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

const abiPath = path.resolve(__dirname, '../artifacts/contracts/PlayGame.sol/PlayGame.json');
const playGameAbi = require(abiPath).abi;

const playGameContract = new ethers.Contract(
    process.env.PLAY_GAME_CONTRACT_ADDRESS,
    playGameAbi,
    wallet
);

const queue = {};
const connectedWallets = new Set();

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error("No wallet address provided"));
    }
    socket.userAddress = token;
    next();
});

io.on('connection', (socket) => {
    const address = socket.userAddress;
    console.log(`New connection: ${socket.id} from address ${address}`);

    if (connectedWallets.has(address)) {
        console.log(`Duplicate connection detected for ${address}. Disconnecting new socket.`);
        socket.disconnect(true);
        return;
    }
    connectedWallets.add(address);

    socket.on('joinQueue', ({ stake }) => {
        if (stake === undefined) {
            return;
        }
        console.log(`Player ${address} queued (stake: ${stake})`);

        if (queue[stake]?.some(p => p.address === address)) {
            return;
        }

        if (queue[stake]?.length > 0) {
            const player1 = queue[stake].shift();
            const player2 = { address, socketId: socket.id };
            const matchId = uuidv4();

            console.log(`Match found! ${player1.address} vs ${player2.address}`);

            io.to(player1.socketId).emit('matchFound', {
                opponent: player2.address,
                matchId,
                role: 'p1',
                stake
            });
            
            socket.emit('matchFound', {
                opponent: player1.address,
                matchId,
                role: 'p2',
                stake
            });
        } else {
            queue[stake] = queue[stake] || [];
            queue[stake].push({ address, socketId: socket.id });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id} from address ${address}`);
        connectedWallets.delete(address);
        for (const stake in queue) {
            queue[stake] = queue[stake].filter(p => p.socketId !== socket.id);
        }
    });
});

app.post('/match/start', async (req, res) => {
    const { matchId, p1, p2, stake } = req.body;
    if (!matchId || !p1 || !p2 || stake === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        console.log(`Creating match ${matchId}...`);
        const stakeAmount = ethers.parseUnits(stake.toString(), 18);
        const tx = await playGameContract.createMatch(matchId, p1, p2, stakeAmount);
        await tx.wait();
        console.log(`Match created! TX: ${tx.hash}`);
        res.status(200).json({ message: 'Match created', txHash: tx.hash });
    } catch (error) {
        console.error('Match creation failed:', error);
        res.status(500).json({ error: 'Match creation failed', details: error.reason || error.message });
    }
});

app.post('/match/result', async (req, res) => {
    const { matchId, winner } = req.body;
    if (!matchId || !winner) {
        return res.status(400).json({ error: 'Missing matchId or winner' });
    }
    try {
        console.log(`Submitting result for match ${matchId}...`);
        const tx = await playGameContract.commitResult(matchId, winner);
        await tx.wait();
        console.log(`Result submitted! Winner: ${winner}. TX: ${tx.hash}`);
        res.status(200).json({ message: 'Result submitted', txHash: tx.hash });
    } catch (error) {
        console.error('Result submission failed:', error);
        res.status(500).json({ error: 'Result submission failed', details: error.reason || error.message });
    }
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
    console.log(`Server ready on port ${port}`);
    console.log(`Contract: ${process.env.PLAY_GAME_CONTRACT_ADDRESS}`);
    console.log(`Operator: ${wallet.address}`);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
});