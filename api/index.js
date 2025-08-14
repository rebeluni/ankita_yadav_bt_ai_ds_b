// Load environment variables from the .env file in the parent directory
require('dotenv').config({ path: '../.env' });

const express = require('express');
const { ethers } = require('ethers');

const app = express();
// This allows our server to understand JSON data in requests
app.use(express.json());

// --- CONFIGURATION ---
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
// const privateKey = process.env.OPERATOR_PRIVATE_KEY;
// --- CONFIGURATION ---

// const privateKey = process.env.OPERATOR_PRIVATE_KEY; // We are temporarily disabling this line
const privateKey = "0x5c6966c782e4880456248f20c60ec20886ca8a0e308197a62abde1cce9f4546e";
const wallet = new ethers.Wallet(privateKey, provider);

// You'll get these addresses after you deploy your contracts
const PLAY_GAME_ADDRESS = "0x7ee5A3B438a0688dF12608839cE7A8B6279BA858";
// The ABI is the instruction manual for the contract. We get this from the artifacts folder.
const playGameAbi = require('../artifacts/contracts/PlayGame.sol/PlayGame.json').abi;

// Create a connection to our deployed PlayGame contract
const playGameContract = new ethers.Contract(PLAY_GAME_ADDRESS, playGameAbi, wallet);

// --- API ENDPOINTS ---

// Endpoint to create a new match
app.post('/match/start', async (req, res) => {
    // Get match details from the request body
    const { matchId, p1, p2, stake } = req.body;

    try {
        console.log(`Creating match ${matchId}...`);
        // Convert the stake to the correct format (18 decimals)
        const stakeAmount = ethers.parseUnits(stake, 18);
        
        // Call the createMatch function on the smart contract
        const tx = await playGameContract.createMatch(matchId, p1, p2, stakeAmount);
        await tx.wait(); // Wait for the transaction to be mined

        console.log(`Match ${matchId} created successfully! Tx: ${tx.hash}`);
        res.status(200).json({ message: 'Match created successfully', txHash: tx.hash });
    } catch (error) {
        console.error('Error creating match:', error);
        res.status(500).json({ error: 'Failed to create match' });
    }
});

// Endpoint to submit the result of a match
app.post('/match/result', async (req, res) => {
    const { matchId, winner } = req.body;

    try {
        console.log(`Submitting result for match ${matchId}...`);
        
        // Call the commitResult function on the smart contract
        const tx = await playGameContract.commitResult(matchId, winner);
        await tx.wait();

        console.log(`Result for ${matchId} submitted! Winner: ${winner}. Tx: ${tx.hash}`);
        res.status(200).json({ message: 'Result submitted successfully', txHash: tx.hash });
    } catch (error) {
        console.error('Error submitting result:', error);
        res.status(500).json({ error: 'Failed to submit result' });
    }
});


// Start the server
const port = 3000;
app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
    console.log('Ready to receive match requests.');
});