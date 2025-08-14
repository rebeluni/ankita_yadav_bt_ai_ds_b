const statusDisplay = document.querySelector('.game--status');
const findMatchButton = document.querySelector('.game--restart');
const stakeInput = document.getElementById('stakeInput');
const cells = document.querySelectorAll('.cell');

let gameState = ["", "", "", "", "", "", "", "", ""];
const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
    [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
];

let gameActive = false;
let currentPlayerSymbol = "X";
let userAddress = "";
let matchId = "";
let socket;

const { ethers } = window;
const VERCEL_URL = "https://ankita-yadav-bt-ai-ds-b.vercel.app";
const API_URL = `${VERCEL_URL}/api`;
let provider, signer;

findMatchButton.addEventListener('click', findMatch);
cells.forEach(cell => cell.addEventListener('click', handleCellClick));

async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        return alert("Please install MetaMask to use this dApp.");
    }
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();
        document.getElementById('connectButton').textContent = 'Connected';
        document.getElementById('connectButton').disabled = true;
        statusDisplay.textContent = `Connected: ${userAddress.substring(0, 6)}...`;
    } catch (error) {
        statusDisplay.textContent = "Failed to connect wallet.";
    }
}

function findMatch() {
    if (!signer) return alert("Please connect your wallet first.");
    const stake = stakeInput.value;
    statusDisplay.textContent = `Looking for a match with a ${stake} GT stake...`;

    socket = io(VERCEL_URL, {
        path: "/socket.io/", // This path must match the server
    });

    socket.on('connect', () => {
        socket.emit('joinQueue', { address: userAddress, stake });
    });

    socket.on('matchFound', (data) => {
        matchId = data.matchId;
        currentPlayerSymbol = data.role === 'p1' ? 'X' : 'O';
        statusDisplay.textContent = `Match found! You are '${currentPlayerSymbol}'. Game is live.`;
        gameActive = true;
    });

    socket.on('connect_error', () => {
        statusDisplay.textContent = "Could not connect to server.";
    });
}

function handleCellPlayed(clickedCell, clickedCellIndex) {
    if (gameState[clickedCellIndex] !== "" || !gameActive) return;
    gameState[clickedCellIndex] = currentPlayerSymbol;
    clickedCell.innerHTML = currentPlayerSymbol;
}

function handleResultValidation() {
    let roundWon = false;
    for (let i = 0; i < winningConditions.length; i++) {
        const winCondition = winningConditions[i];
        const a = gameState[winCondition[0]];
        const b = gameState[winCondition[1]];
        const c = gameState[winCondition[2]];
        if (a === '' || b === '' || c === '') continue;
        if (a === b && b === c) {
            roundWon = true;
            break;
        }
    }
    if (roundWon) {
        gameActive = false;
        submitResult();
    } else if (!gameState.includes("")) {
        statusDisplay.textContent = "Game ended in a draw!";
        gameActive = false;
    }
}

async function submitResult() {
    if (!matchId) return;
    statusDisplay.textContent = `You won! Submitting result...`;
    try {
        const response = await fetch(`${API_URL}/match/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, winner: userAddress })
        });
        const data = await response.json();
        if (data.txHash) {
            const explorerLink = `https://sepolia.etherscan.io/tx/${data.txHash}`;
            statusDisplay.innerHTML = `You won! Payout sent. <a href="${explorerLink}" target="_blank">View Transaction</a>`;
        }
    } catch (error) {
        statusDisplay.textContent = "Failed to submit result.";
    }
}

function handleCellClick(clickedCellEvent) {
    const clickedCell = clickedCellEvent.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-cell-index'));
    handleCellPlayed(clickedCell, clickedCellIndex);
    handleResultValidation();
}
