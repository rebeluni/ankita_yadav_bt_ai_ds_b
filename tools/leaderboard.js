require('dotenv').config({ path: '../.env' }); // Point to the root .env file
const { ethers } = require('ethers');
const express = require('express');


const playerStats = {};

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const PLAY_GAME_ADDRESS = process.env.PLAY_GAME_CONTRACT_ADDRESS;
const playGameAbi = require('../artifacts/contracts/PlayGame.sol/PlayGame.json').abi;

const playGameContract = new ethers.Contract(PLAY_GAME_ADDRESS, playGameAbi, provider);

async function listenToEvents() {
    console.log("Listening for smart contract events...");

    playGameContract.on("Settled", (matchId, winner, prize) => {
        console.log(`Event: Match Settled! Winner: ${winner}, Prize: ${ethers.formatEther(prize)} GT`);
        
        if (!playerStats[winner]) {
            playerStats[winner] = { wins: 0, matchesPlayed: 0, totalGTWon: "0" };
        }
        
        playerStats[winner].wins += 1;
        
        const currentWinnings = BigInt(playerStats[winner].totalGTWon);
        const newPrize = BigInt(prize.toString());
        playerStats[winner].totalGTWon = (currentWinnings + newPrize).toString();
    });

    playGameContract.on("Staked", (matchId, player) => {
        console.log(`Event: Player Staked! Player: ${player}`);
        
        if (!playerStats[player]) {
            playerStats[player] = { wins: 0, matchesPlayed: 0, totalGTWon: "0" };
        }
        
        playerStats[player].matchesPlayed += 1;
    });

    console.log("Leaderboard indexer is running.");
}

listenToEvents().catch(error => {
    console.error("Error listening to events:", error);
    process.exit(1);
});

const app = express();
const port = 4000; // Use a different port than the main API

app.get('/leaderboard', (req, res) => {
    const leaderboardArray = Object.entries(playerStats).map(([address, stats]) => {
        return {
            address,
            wins: stats.wins,
            matchesPlayed: stats.matchesPlayed,
            totalGTWon: ethers.formatEther(stats.totalGTWon),
        };
    });

    leaderboardArray.sort((a, b) => parseFloat(b.totalGTWon) - parseFloat(a.totalGTWon));

    res.json(leaderboardArray.slice(0, 10));
});

app.listen(port, () => {
    console.log(`Leaderboard API server running at http://localhost:${port}`);
});