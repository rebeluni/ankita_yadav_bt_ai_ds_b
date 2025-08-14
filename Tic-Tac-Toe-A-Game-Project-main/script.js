// --- HTML Element References ---
const statusDisplay = document.querySelector('.game--status');
const findMatchButton = document.querySelector('.game--restart');
const stakeInput = document.getElementById('stakeInput');
const cells = document.querySelectorAll('.cell');

// --- Game State & Logic Variables ---
let gameState = ["", "", "", "", "", "", "", "", ""];
const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
    [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
];

// --- Web3 & Trix System Variables ---
let gameActive = false;
let currentPlayerSymbol = "X";
let userAddress = "";
let matchId = "";
let socket;

// --- Ethers.js & Server Configuration ---
// These are loaded from the <script> tags in your index.html
const { ethers } = window; // Correctly reference the ethers library from the window object
const VERCEL_URL = "https://ankita-yadav-bt-ai-ds-b.vercel.app";
const API_URL = `${VERCEL_URL}/api`;
let provider, signer;

// --- Event Listeners ---
// The connectWallet function is called directly from the HTML's onclick attribute.
findMatchButton.addEventListener('click', findMatch);
cells.forEach(cell => cell.addEventListener('click', handleCellClick));

// --- Core Functions ---

// This function is now correctly defined in the global scope to work with your button's onclick attribute.
async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        statusDisplay.textContent = "Please install MetaMask!";
        return alert("Please install MetaMask to use this dApp.");
    }
    try {
        // Use the modern Ethers v6 provider
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();

        document.getElementById('connectButton').textContent = 'Connected';
        document.getElementById('connectButton').disabled = true;
        statusDisplay.textContent = `Connected: ${userAddress.substring(0, 6)}...`;
    } catch (error) {
        console.error("Failed to connect wallet:", error);
        statusDisplay.textContent = "Failed to connect wallet.";
    }
}

function findMatch() {
    if (!signer) {
        return alert("Please connect your wallet first.");
    }
    const stake = stakeInput.value;
    if (!stake || isNaN(stake) || parseFloat(stake) <= 0) {
        return alert("Please enter a valid stake amount.");
    }

    statusDisplay.textContent = `Looking for a match with a ${stake} GT stake...`;

    // Connect to the live matchmaking server on Vercel with the correct path
    socket = io(VERCEL_URL, {
        path: "/socket.io/",
    });

    socket.on('connect', () => {
        console.log('Successfully connected to matchmaking server!');
        // Once connected, join the queue using socket.emit
        socket.emit('joinQueue', { address: userAddress, stake });
    });

    socket.on('matchFound', handleMatchFound);

    socket.on('connect_error', (err) => {
        console.error("Connection Error:", err);
        statusDisplay.textContent = "Could not connect to server.";
    });
}

async function handleMatchFound(data) {
    console.log("Match found!", data);
    statusDisplay.textContent = `Match found against ${data.opponent.substring(0, 6)}...! You are '${data.role === 'p1' ? 'X' : 'O'}'`;
    
    matchId = data.matchId;
    currentPlayerSymbol = data.role === 'p1' ? 'X' : 'O';
    
    // In a real-world scenario, you would now prompt for on-chain staking.
    // For this project, we'll assume the backend handles the stake creation.
    statusDisplay.textContent = "Game is live! It's your turn.";
    gameActive = true;
}

function handleCellPlayed(clickedCell, clickedCellIndex) {
    if (gameState[clickedCellIndex] !== "" || !gameActive) {
        return;
    }
    gameState[clickedCellIndex] = currentPlayerSymbol;
    clickedCell.innerHTML = currentPlayerSymbol;
    // In a full multiplayer game, you would emit this move to the opponent via the socket server.
}

function handleResultValidation() {
    let roundWon = false;
    for (let i = 0; i < winningConditions.length; i++) {
        const winCondition = winningConditions[i];
        const a = gameState[winCondition[0]];
        const b = gameState[winCondition[1]];
        const c = gameState[winCondition[2]];
        if (a === '' || b === '' || c === '') {
            continue;
        }
        if (a === b && b === c) {
            roundWon = true;
            break;
        }
    }

    if (roundWon) {
        gameActive = false;
        // The winning player's client notifies the backend to commit the result.
        submitResult();
        return;
    }

    const roundDraw = !gameState.includes("");
    if (roundDraw) {
        statusDisplay.textContent = "Game ended in a draw!";
        gameActive = false;
        // You might want to trigger a refund via the API here.
        return;
    }
}

async function submitResult() {
    if (!matchId) return;
    console.log(`Submitting result for match ${matchId}. Winner: ${userAddress}`);
    statusDisplay.textContent = `You won! Submitting result to the blockchain...`;
    
    try {
        const response = await fetch(`${API_URL}/match/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, winner: userAddress })
        });
        const data = await response.json();
        
        if (data.txHash) {
            const explorerLink = `https://sepolia.etherscan.io/tx/${data.txHash}`;
            statusDisplay.innerHTML = `You won! Payout sent. <a href="${explorerLink}" target="_blank">View on Etherscan</a>`;
        } else {
            statusDisplay.textContent = "Result submitted, but no tx hash returned.";
        }
    } catch (error) {
        console.error("Error submitting result:", error);
        statusDisplay.textContent = "Failed to submit result.";
    }
}

function handleCellClick(clickedCellEvent) {
    const clickedCell = clickedCellEvent.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-cell-index'));
    handleCellPlayed(clickedCell, clickedCellIndex);
    handleResultValidation();
}
