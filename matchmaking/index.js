const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const server = http.createServer();

const io = new Server(server, {
  cors: {
    origin: "*", // Allows connections from any website
  },
  path: "/socket.io/", // The channel for communication
});

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const API_GATEWAY_URL = 'https://ankita-yadav-bt-ai-ds-b.vercel.app/api'; 

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('joinQueue', async ({ address, stake }) => {
        console.log(`Player ${address} wants to join queue with stake ${stake}`);
        try {
            let queue = await kv.get('matchmaking_queue') || {};
            if (queue[stake] && queue[stake].length > 0) {
                const opponent = queue[stake].shift(); 
                if (opponent.address === address) {
                    queue[stake].unshift(opponent);
                    await kv.set('matchmaking_queue', queue);
                    return;
                }
                const matchId = uuidv4();
                await kv.set('matchmaking_queue', queue);
                io.to(opponent.socketId).emit('matchFound', { opponent: address, matchId, role: 'p2' });
                socket.emit('matchFound', { opponent: opponent.address, matchId, role: 'p1' });
                
                await axios.post(`${API_GATEWAY_URL}/match/start`, {
                    matchId, p1: address, p2: opponent.address, stake
                });
            } else {
                if (!queue[stake]) queue[stake] = [];
                queue[stake].push({ address, socketId: socket.id });
                await kv.set('matchmaking_queue', queue);
            }
        } catch (error) {
            console.error("Error during matchmaking:", error);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// This is the required export for Vercel's serverless environment
module.exports = server;
