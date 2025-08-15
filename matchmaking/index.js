const { Server } = require("socket.io");
const { createClient } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL;

module.exports = (req, res) => {
    if (!res.socket.server.io) {
        console.log("Setting up new Socket.IO server...");
        
        const io = new Server(res.socket.server, {
            path: "/socket.io/",
            addTrailingSlash: false,
            cors: { origin: "*" },
        });

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

                        console.log(`Match found for stake ${stake}: ${address} vs ${opponent.address}`);
                        const matchId = uuidv4();
                        await kv.set('matchmaking_queue', queue);
                        
                        io.to(opponent.socketId).emit('matchFound', { opponent: address, matchId, role: 'p2' });
                        socket.emit('matchFound', { opponent: opponent.address, matchId, role: 'p1' });
                        
                        console.log(`Notified players. Creating match on-chain with ID: ${matchId}`);
                        
                        await axios.post(`${API_GATEWAY_URL}/match/start`, {
                            matchId,
                            p1: address,
                            p2: opponent.address,
                            stake
                        });

                    } else {
                        if (!queue[stake]) queue[stake] = [];
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
            });
        });

        res.socket.server.io = io;
    }
    res.end();
};