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

// Enhanced Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: [
      "https://ankita-yadav-bt-ai-ds-b.vercel.app",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io/",
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

// Validate essential environment variables
const requiredEnvVars = ['RPC_URL', 'OPERATOR_PRIVATE_KEY', 'PLAY_GAME_CONTRACT_ADDRESS'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize blockchain provider and wallet
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

// Load contract ABI
let playGameAbi;
try {
  playGameAbi = require(path.resolve(__dirname, '../artifacts/contracts/PlayGame.sol/PlayGame.json')).abi;
} catch (err) {
  console.error('❌ Failed to load contract ABI:', err);
  process.exit(1);
}

const playGameContract = new ethers.Contract(
  process.env.PLAY_GAME_CONTRACT_ADDRESS,
  playGameAbi,
  wallet
);

// Game state management
const queue = {};
const connectedWallets = new Map(); // Using Map for better performance

// Connection middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log('⚠️ Connection attempt without wallet address');
    return next(new Error("Wallet address required"));
  }
  socket.userAddress = token.toLowerCase(); // Normalize address
  next();
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  const address = socket.userAddress;
  console.log(`🔌 New connection: ${socket.id} (${address})`);

  // Prevent duplicate connections
  if (connectedWallets.has(address)) {
    const existingSocketId = connectedWallets.get(address);
    console.log(`⚠️ Duplicate connection for ${address}, disconnecting previous: ${existingSocketId}`);
    io.to(existingSocketId).emit('error', { error: "New connection detected" });
    io.to(existingSocketId).disconnect(true);
  }
  connectedWallets.set(address, socket.id);

  // Matchmaking queue handler
  socket.on('joinQueue', ({ stake }, callback = () => {}) => {
    try {
      if (!stake || isNaN(stake)) {
        return callback({ error: "Invalid stake amount" });
      }

      // Clean up any existing queue entries for this player
      for (const stakeAmount in queue) {
        queue[stakeAmount] = queue[stakeAmount].filter(p => p.address !== address);
      }

      // Check for matching opponent
      if (queue[stake]?.length > 0) {
        const player1 = queue[stake].shift();
        const matchId = uuidv4();

        console.log(`🎮 Match found: ${player1.address} vs ${address} (Stake: ${stake})`);
        
        // Notify both players
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
        
        return callback({ success: true, matchId });
      }

      // Add to queue if no match found
      queue[stake] = queue[stake] || [];
      queue[stake].push({ address, socketId: socket.id });
      console.log(`⏳ Player queued: ${address} (Stake: ${stake})`);
      callback({ success: true, status: 'waiting' });

    } catch (err) {
      console.error('Queue error:', err);
      callback({ error: "Internal server error" });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id} (${address})`);
    connectedWallets.delete(address);
    
    // Clean up from all queues
    for (const stake in queue) {
      const initialLength = queue[stake].length;
      queue[stake] = queue[stake].filter(p => p.socketId !== socket.id);
      if (initialLength !== queue[stake].length) {
        console.log(`🧹 Removed ${address} from ${stake} queue`);
      }
    }
  });

  // Keepalive handler
  socket.on('ping', (cb) => cb());
});

// API Endpoints
app.post('/match/start', async (req, res) => {
  try {
    const { matchId, p1, p2, stake } = req.body;
    
    if (!matchId || !p1 || !p2 || stake === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`⚡ Creating match ${matchId}...`);
    const stakeAmount = ethers.parseUnits(stake.toString(), 18);
    const tx = await playGameContract.createMatch(matchId, p1, p2, stakeAmount);
    const receipt = await tx.wait();
    
    console.log(`✅ Match created: ${tx.hash}`);
    return res.json({ 
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    });

  } catch (error) {
    console.error('Match creation failed:', error);
    return res.status(500).json({ 
      error: error.reason || 'Transaction failed',
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

    console.log(`⚡ Submitting result for match ${matchId}...`);
    const tx = await playGameContract.commitResult(matchId, winner);
    const receipt = await tx.wait();
    
    console.log(`✅ Result submitted: ${tx.hash}`);
    return res.json({ 
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    });

  } catch (error) {
    console.error('Result submission failed:', error);
    return res.status(500).json({ 
      error: error.reason || 'Transaction failed',
      details: error.message 
    });
  }
});

// Server startup
const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📜 Contract: ${process.env.PLAY_GAME_CONTRACT_ADDRESS}`);
  console.log(`👛 Operator: ${wallet.address}`);
  console.log(`🌐 WebSocket path: /socket.io/`);
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('🔴 Server closed');
    process.exit(0);
  });
});