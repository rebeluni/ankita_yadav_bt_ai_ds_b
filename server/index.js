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
    origin: [
      "https://ankita-yadav-bt-ai-ds-b.vercel.app",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io/", // Explicit path
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000 // 2 minutes
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
  console.log(`Connection attempt from: ${socket.handshake.headers.origin || 'unknown'}`);
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Wallet address required"));
  socket.userAddress = token;
  next();
});

io.on('connection', (socket) => {
  const address = socket.userAddress;
  console.log(`✅ Connected: ${socket.id} (${address})`);

  if (connectedWallets.has(address)) {
    socket.emit("error", { error: "Wallet already connected" });
    return socket.disconnect(true);
  }
  connectedWallets.add(address);

  socket.on('joinQueue', ({ stake }, callback = () => {}) => {
    if (!stake) return callback({ error: "Missing stake amount" });

    for (const s in queue) {
      queue[s] = queue[s].filter(p => p.address !== address);
    }

    if (queue[stake]?.length > 0) {
      const player1 = queue[stake].shift();
      const matchId = uuidv4();

      console.log(`🤝 Match found: ${player1.address} vs ${address}`);
      
      io.to(player1.socketId).emit('matchFound', {
        opponent: address,
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
      
      callback({ success: true, matchId });
    } else {
      queue[stake] = queue[stake] || [];
      queue[stake].push({ address, socketId: socket.id });
      callback({ success: true, status: 'waiting' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id} (${address})`);
    connectedWallets.delete(address);
    for (const stake in queue) {
      queue[stake] = queue[stake].filter(p => p.socketId !== socket.id);
    }
  });
});

app.post('/match/start', async (req, res) => {
  try {
    const { matchId, p1, p2, stake } = req.body;
    if (!matchId || !p1 || !p2 || stake === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`🏁 Creating match ${matchId}...`);
    const stakeAmount = ethers.parseUnits(stake.toString(), 18);
    const tx = await playGameContract.createMatch(matchId, p1, p2, stakeAmount);
    const receipt = await tx.wait();
    
    res.status(200).json({ 
      message: 'Match created', 
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error('💥 Match creation failed:', error);
    res.status(500).json({ 
      error: error.reason || 'Match creation failed',
      details: error.message 
    });
  }
});

app.post('/match/result', async (req, res) => {
  try {
    const { matchId, winner } = req.body;
    if (!matchId || !winner) {
      return res.status(400).json({ error: 'Missing matchId or winner' });
    }

    console.log(`🏁 Submitting result for match ${matchId}...`);
    const tx = await playGameContract.commitResult(matchId, winner);
    const receipt = await tx.wait();
    
    res.status(200).json({ 
      message: 'Result submitted', 
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error('💥 Result submission failed:', error);
    res.status(500).json({ 
      error: error.reason || 'Result submission failed',
      details: error.message 
    });
  }
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`🚀 Server ready on port ${port}`);
  console.log(`📜 Contract: ${process.env.PLAY_GAME_CONTRACT_ADDRESS}`);
  console.log(`👛 Operator: ${wallet.address}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});