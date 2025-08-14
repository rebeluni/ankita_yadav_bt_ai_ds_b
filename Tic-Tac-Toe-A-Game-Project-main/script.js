// --- ORIGINAL GAME VARIABLES ---
const statusDisplay = document.querySelector('.game--status');
let gameState = ["", "", "", "", "", "", "", "", ""];
const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
    [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
];

// --- NEW TRIX SYSTEM VARIABLES ---
let gameActive = false; // Game is INACTIVE by default until staking is complete
let currentPlayerSymbol = "X"; // This player's symbol ('X' or 'O')
let localPlayerAddress = "";
let matchId = "";
let stakeAmount = "10"; // Default stake, can be changed via an input field

// --- NEW: Connection to your backend services ---
const matchmakingServerUrl = "http://localhost:8000";
const apiGatewayUrl = "http://localhost:3000";
const socket = io(matchmakingServerUrl);

// --- NEW: Ethers.js setup for interacting with contracts ---
let provider, signer, gameTokenContract, playGameContract;

const gameTokenAddress = "0x2FE6ad84f58A05D542D587b84DfE3ea8009544D5";
const playGameAddress = "0x7ee5A3B438a0688dF12608839cE7A8B6279BA858";
const gameTokenABI = [
  {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
  {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"allowance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientAllowance","type":"error"},
  {"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientBalance","type":"error"},
  {"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC20InvalidApprover","type":"error"},
  {"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC20InvalidReceiver","type":"error"},
  {"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC20InvalidSender","type":"error"},
  {"inputs":[{"internalType":"address","name":"spender","type":"address"}],"name":"ERC20InvalidSpender","type":"error"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},
  {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}
];
const playGameABI = [
  {"inputs":[{"internalType":"address","name":"_gameTokenAddress","type":"address"},{"internalType":"address","name":"_operatorAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"p1","type":"address"},{"indexed":true,"internalType":"address","name":"p2","type":"address"},{"indexed":false,"internalType":"uint256","name":"stake","type":"uint256"}],"name":"MatchCreated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"}],"name":"Refunded","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"winner","type":"address"},{"indexed":false,"internalType":"uint256","name":"prize","type":"uint256"}],"name":"Settled","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"player","type":"address"}],"name":"Staked","type":"event"},
  {"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"},{"internalType":"address","name":"winner","type":"address"}],"name":"commitResult","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"},{"internalType":"address","name":"p1","type":"address"},{"internalType":"address","name":"p2","type":"address"},{"internalType":"uint256","name":"_stake","type":"uint256"}],"name":"createMatch","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"gameToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"matches","outputs":[{"internalType":"address","name":"player1","type":"address"},{"internalType":"address","name":"player2","type":"address"},{"internalType":"uint256","name":"stakeAmount","type":"uint256"},{"internalType":"enum PlayGame.MatchStatus","name":"status","type":"uint8"},{"internalType":"bool","name":"p1_staked","type":"bool"},{"internalType":"bool","name":"p2_staked","type":"bool"},{"internalType":"uint256","name":"startTime","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"operator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"}],"name":"refund","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"}],"name":"stake","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

// --- NEW: Core Integration Functions ---

async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        return alert("Please install MetaMask to use this dApp.");
    }
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    localPlayerAddress = await signer.getAddress();
    
    gameTokenContract = new ethers.Contract(gameTokenAddress, gameTokenABI, signer);
    playGameContract = new ethers.Contract(playGameAddress, playGameABI, signer);

    statusDisplay.innerHTML = `Connected: ${localPlayerAddress.substring(0, 6)}...`;
}

async function findMatch() {
    if (!signer) return alert("Please connect your wallet first.");
    statusDisplay.innerHTML = `Looking for a match with a ${stakeAmount} GT stake...`;
    
    await fetch(`${matchmakingServerUrl}/join-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            address: localPlayerAddress,
            stake: stakeAmount,
            socketId: socket.id
        })
    });
}

socket.on("matchFound", async (data) => {
    statusDisplay.innerHTML = `Match found against ${data.opponent.substring(0, 6)}...! You are '${data.startsAs}'. Staking now...`;
    currentPlayerSymbol = data.startsAs;
    matchId = ethers.id(`${localPlayerAddress}-${data.opponent}-${Date.now()}`);

    try {
        const stakeInWei = ethers.parseUnits(stakeAmount, 18);
        const approveTx = await gameTokenContract.approve(playGameAddress, stakeInWei);
        await approveTx.wait();
        statusDisplay.innerHTML = "Approval successful. Staking...";

        const stakeTx = await playGameContract.stake(matchId);
        await stakeTx.wait();
        statusDisplay.innerHTML = "Stake successful! Waiting for opponent...";
        gameActive = true; 
        statusDisplay.innerHTML = "Game is live! It's your turn.";
    } catch (error) {
        console.error("Staking failed:", error);
        statusDisplay.innerHTML = "Staking failed. Please try again.";
    }
});

// --- MODIFIED ORIGINAL GAME FUNCTIONS ---

function handleCellPlayed(clickedCell, clickedCellIndex) {
    gameState[clickedCellIndex] = currentPlayerSymbol;
    clickedCell.innerHTML = currentPlayerSymbol;
}

function handleResultValidation() {
    let roundWon = false;
    let winnerSymbol = "";
    for (let i = 0; i < winningConditions.length; i++) {
        const winCondition = winningConditions[i];
        const a = gameState[winCondition[0]];
        const b = gameState[winCondition[1]];
        const c = gameState[winCondition[2]];
        if (a === '' || b === '' || c === '') continue;
        if (a === b && b === c) {
            roundWon = true;
            winnerSymbol = a;
            break;
        }
    }

    if (roundWon) {
        gameActive = false;
        if (winnerSymbol === currentPlayerSymbol) {
            statusDisplay.innerHTML = `You won! Submitting result to the blockchain...`;
            fetch(`${apiGatewayUrl}/match/result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId, winner: localPlayerAddress })
            }).then(res => res.json()).then(data => {
                const explorerLink = `https://sepolia.etherscan.io/tx/${data.txHash}`;
                statusDisplay.innerHTML = `You won! Payout sent. <a href="${explorerLink}" target="_blank">View on Etherscan</a>`;
            });
        } else {
            statusDisplay.innerHTML = `You lost. Better luck next time!`;
        }
        return;
    }

    const roundDraw = !gameState.includes("");
    if (roundDraw) {
        statusDisplay.innerHTML = `Game ended in a draw!`;
        gameActive = false;
        return;
    }
}

function handleCellClick(clickedCellEvent) {
    const clickedCell = clickedCellEvent.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-cell-index'));

    if (gameState[clickedCellIndex] !== "" || !gameActive) return;

    handleCellPlayed(clickedCell, clickedCellIndex);
    handleResultValidation();
}

// You will need to add a "Connect Wallet" button to your HTML that calls connectWallet().
// e.g., <button onclick="connectWallet()">Connect Wallet</button>
document.querySelector('.game--restart').addEventListener('click', findMatch);
document.querySelectorAll('.cell').forEach(cell => cell.addEventListener('click', handleCellClick));