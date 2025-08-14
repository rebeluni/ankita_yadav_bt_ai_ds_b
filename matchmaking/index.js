const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app =express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
    }
});

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const API_GATEWAY_URL = 'https://ankita-yadav-bt-ai-ds-b.vercel.app/api'; // Your Vercel API endpoint

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('joinQueue', async ({ address, stake }) => {
        console.log(`Player ${address} with socketId ${socket.id} wants to join queue with stake ${stake}`);

        try {
            let queue = await kv.get('matchmaking_queue') || {};
            
            if (queue[stake] && queue[stake].length > 0) {
                const opponent = queue[stake].shift(); // Get the first player waiting
                
                if (opponent.address === address) {
                    queue[stake].unshift(opponent);
                    await kv.set('matchmaking_queue', queue);
                    console.log(`Player ${address} tried to match with themselves. Waiting for another player.`);
                    return;
                }

                console.log(`Match found for stake ${stake}: ${address} vs ${opponent.address}`);
                
                const matchId = uuidv4();
                const player1 = address;
                const player2 = opponent.address;

                await kv.set('matchmaking_queue', queue);

                io.to(opponent.socketId).emit('matchFound', { opponent: player1, matchId, role: 'p2' });
                socket.emit('matchFound', { opponent: player2, matchId, role: 'p1' });
                
                console.log(`Notified players. Creating match on-chain with ID: ${matchId}`);

                await axios.post(`${API_GATEWAY_URL}/match/start`, {
                    matchId,
                    p1: player1,
                    p2: player2,
                    stake
                });

                console.log(`On-chain match creation requested for ${matchId}`);

            } else {
                if (!queue[stake]) {
                    queue[stake] = [];
                }
                queue[stake].push({ address, socketId: socket.id });
                await kv.set('matchmaking_queue', queue);
                console.log(`Player ${address} added to queue for stake ${stake}`);
            }
        } catch (error) {
            console.error("Error during matchmaking:", error);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        removeUserFromQueue(socket.id);
    });
});

const PORT = 8000;
server.listen(PORT, () => {
    console.log(`Matchmaking server listening on port ${PORT}`);
});
