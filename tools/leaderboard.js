require('dotenv').config({ path: '../.env' }); // Point to the root .env file
const { ethers } = require('ethers');
const express = require('express');

// --- DATABASE (In-Memory) ---
// For a real project, you would use a database like SQLite or PostgreSQL.
// For this assessment, a simple in-memory object is sufficient.
const playerStats = {};
// Example structure for playerStats:
// {
//   "0xPlayerAddress": {
//     "wins": 2,
//     "matchesPlayed": 5,
//     "totalGTWon": "50000000000000000000" // Stored as a string to handle large numbers
//   }
// }

// --- CONFIGURATION ---
const provider = new ethers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/pOI1RTeEpxFUL_zbmW3C2");
const PLAY_GAME_ADDRESS = "0x7ee5A3B438a0688dF12608839cE7A8B6279BA858";
const playGameAbi = require('../artifacts/contracts/PlayGame.sol/PlayGame.json').abi;

const playGameContract = new ethers.Contract(PLAY_GAME_ADDRESS, playGameAbi, provider);

// --- EVENT LISTENER ---
async function listenToEvents() {
    console.log("Listening for smart contract events...");

    // Listen for the 'Settled' event
    playGameContract.on("Settled", (matchId, winner, prize) => {
        console.log(`Event: Match Settled! Winner: ${winner}, Prize: ${ethers.formatEther(prize)} GT`);
        
        // Initialize player stats if they don't exist
        if (!playerStats[winner]) {
            playerStats[winner] = { wins: 0, matchesPlayed: 0, totalGTWon: "0" };
        }
        
        playerStats[winner].wins += 1;
        
        // Handle large numbers safely using BigInt
        const currentWinnings = BigInt(playerStats[winner].totalGTWon);
        const newPrize = BigInt(prize.toString());
        playerStats[winner].totalGTWon = (currentWinnings + newPrize).toString();
    });

    // Listen for the 'Staked' event to track matches played
    playGameContract.on("Staked", (matchId, player) => {
        console.log(`Event: Player Staked! Player: ${player}`);
        
        if (!playerStats[player]) {
            playerStats[player] = { wins: 0, matchesPlayed: 0, totalGTWon: "0" };
        }
        
        // This will count twice per match (once for each player), so we divide by 2 later if needed
        // Or better, adjust logic based on a unique match ID if necessary.
        // For simplicity, we'll increment per stake event.
        playerStats[player].matchesPlayed += 1;
    });

    console.log("Leaderboard indexer is running.");
}

listenToEvents().catch(error => {
    console.error("Error listening to events:", error);
    process.exit(1);
});

// --- API SERVER ---
const app = express();
const port = 4000; // Use a different port than the main API

app.get('/leaderboard', (req, res) => {
    // Convert the playerStats object into an array
    const leaderboardArray = Object.entries(playerStats).map(([address, stats]) => {
        return {
            address,
            wins: stats.wins,
            matchesPlayed: stats.matchesPlayed,
            // Convert GT won to a readable number for the API response
            totalGTWon: ethers.formatEther(stats.totalGTWon),
        };
    });

    // Sort the array by totalGTWon in descending order
    leaderboardArray.sort((a, b) => parseFloat(b.totalGTWon) - parseFloat(a.totalGTWon));

    // Return the top 10 players
    res.json(leaderboardArray.slice(0, 10));
});

app.listen(port, () => {
    console.log(`Leaderboard API server running at http://localhost:${port}`);
});