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

// Enhanced Socket.IO configuration for stability as per advice
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
  transports: ["websocket"], // Force WebSocket for stability
  pingInterval: 25000,
  pingTimeout: 20000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 60000, // Allow for 1 minute of disconnection
    skipMiddlewares: true
  }
});

const requiredEnvVars = ['RPC_URL', 'OPERATOR_PRIVATE_KEY', 'PLAY_GAME_CONTRACT_ADDRESS'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing environment variable: ${envVar}`);
    process.exit(1);
  }
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

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

const queue = {};
const connectedWallets = new Map();
const activeMatches = new Map(); // Track state of active matches as per advice

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
  console.log(`🔌 New connection: ${socket.id} (${address})`);

  if (connectedWallets.has(address)) {
    const existingSocketId = connectedWallets.get(address);
    const existingSocket = io.sockets.sockets.get(existingSocketId);
    if (existingSocket) {
        existingSocket.emit('error', { error: "New connection detected" });
        existingSocket.disconnect(true);
    }
  }
  connectedWallets.set(address, socket.id);

  socket.on('joinQueue', async ({ stake }, callback = () => {}) => {
    try {
      if (!stake || isNaN(stake)) {
        return callback({ error: "Invalid stake amount" });
      }

      for (const stakeAmount in queue) {
        queue[stakeAmount] = queue[stakeAmount].filter(p => p.address !== address);
      }

      if (queue[stake]?.length > 0) {
        const player1 = queue[stake].shift();
        const player2 = { address, socketId: socket.id };
        const uniqueIdString = uuidv4();
        const matchId = ethers.keccak256(ethers.toUtf8Bytes(uniqueIdString));

        console.log(`🎮 Match found: ${player1.address} vs ${player2.address}. Creating on-chain...`);
        
        try {
            const stakeAmount = ethers.parseUnits(stake.toString(), 18);
            const tx = await playGameContract.createMatch(matchId, player1.address, player2.address, stakeAmount);
            await tx.wait();
            console.log(`✅ On-chain match created: ${tx.hash}.`);

            // Track match state as per advice
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
            
            return callback({ success: true, matchId });

        } catch (onChainError) {
            console.error('❌ On-chain match creation failed:', onChainError);
            queue[stake].unshift(player1);
            return callback({ error: "Failed to create match on-chain." });
        }
      } else {
        queue[stake] = queue[stake] || [];
        queue[stake].push({ address, socketId: socket.id });
        console.log(`⏳ Player queued: ${address} (Stake: ${stake})`);
        callback({ success: true, status: 'waiting' });
      }
    } catch (err) {
      console.error('Queue error:', err);
      callback({ error: "Internal server error" });
    }
  });

  // Staking coordination logic as per advice
  socket.on('stakingComplete', ({ matchId }) => {
      const match = activeMatches.get(matchId);
      if (!match) return;

      match.players[address].staked = true;
      console.log(`✅ Player ${address} has staked for match ${matchId}`);

      const bothStaked = Object.values(match.players).every(p => p.staked);
      if (bothStaked) {
          console.log(`🎉 Both players staked for match ${matchId}. Starting game.`);
          Object.values(match.players).forEach(player => {
              io.to(player.socketId).emit('gameReady', { matchId });
          });
      }
  });

  socket.on('stakingFailed', ({ matchId }) => {
      const match = activeMatches.get(matchId);
      if (!match) return;
      console.log(`❌ Player ${address} failed to stake for match ${matchId}`);
      
      Object.values(match.players).forEach(player => {
          if (player.socketId !== socket.id) {
              io.to(player.socketId).emit('opponentStakingFailed');
          }
      });
      activeMatches.delete(matchId);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id} (${address})`);
    connectedWallets.delete(address);
    for (const stake in queue) {
      queue[stake] = queue[stake].filter(p => p.socketId !== socket.id);
    }
  });

  socket.on('ping', (cb) => {
    if (typeof cb === 'function') cb();
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
    console.log(`✅ Result submitted: ${tx.hash}`);
    activeMatches.delete(matchId); // Clean up completed match
    return res.json({ success: true, txHash: tx.hash });
  } catch (error) {
    console.error('Result submission failed:', error);
    return res.status(500).json({ error: error.reason || 'Transaction failed' });
  }
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
