const statusDisplay = document.querySelector('.game--status');
const findMatchButton = document.querySelector('.game--restart');
const connectButton = document.getElementById('connectButton');
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
let provider, signer, gameTokenContract, playGameContract;

const RENDER_URL = "https://trix-backend-final.onrender.com";
const API_URL = RENDER_URL; 

const gameTokenAddress = "0x2FE6ad84f58A05D542D587b84DfE3ea8009544D5";
const playGameAddress = "0x7ee5A3B438a0688dF12608839cE7A8B6279BA858";
const gameTokenABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"allowance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientAllowance","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientBalance","type":"error"},{"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC20InvalidApprover","type":"error"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC20InvalidReceiver","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC20InvalidSender","type":"error"},{"inputs":[{"internalType":"address","name":"spender","type":"address"}],"name":"ERC20InvalidSpender","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];
const playGameABI = [{"inputs":[{"internalType":"address","name":"_gameTokenAddress","type":"address"},{"internalType":"address","name":"_operatorAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"p1","type":"address"},{"indexed":true,"internalType":"address","name":"p2","type":"address"},{"indexed":false,"internalType":"uint256","name":"stake","type":"uint256"}],"name":"MatchCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"}],"name":"Refunded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"winner","type":"address"},{"indexed":false,"internalType":"uint256","name":"prize","type":"uint256"}],"name":"Settled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"player","type":"address"}],"name":"Staked","type":"event"},{"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"},{"internalType":"address","name":"winner","type":"address"}],"name":"commitResult","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"},{"internalType":"address","name":"p1","type":"address"},{"internalType":"address","name":"p2","type":"address"},{"internalType":"uint256","name":"_stake","type":"uint256"}],"name":"createMatch","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"gameToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"matches","outputs":[{"internalType":"address","name":"player1","type":"address"},{"internalType":"address","name":"player2","type":"address"},{"internalType":"uint256","name":"stakeAmount","type":"uint256"},{"internalType":"enum PlayGame.MatchStatus","name":"status","type":"uint8"},{"internalType":"bool","name":"p1_staked","type":"bool"},{"internalType":"bool","name":"p2_staked","type":"bool"},{"internalType":"uint256","name":"startTime","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"operator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"}],"name":"refund","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"}],"name":"stake","outputs":[],"stateMutability":"nonpayable","type":"function"}];

connectButton.addEventListener('click', connectWallet);
findMatchButton.addEventListener('click', findMatch);
cells.forEach(cell => cell.addEventListener('click', handleCellClick));

async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        statusDisplay.textContent = "Please install MetaMask!";
        return alert("Please install MetaMask to use this dApp.");
    }
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();
        
        gameTokenContract = new ethers.Contract(gameTokenAddress, gameTokenABI, signer);
        playGameContract = new ethers.Contract(playGameAddress, playGameABI, signer);

        connectButton.textContent = 'Connected';
        connectButton.disabled = true;
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
    
    socket = io(RENDER_URL, {
        transports: ["websocket"],
        withCredentials: true,
    });

    socket.on('connect', () => {
        console.log('Successfully connected to matchmaking server!');
        socket.emit("joinQueue", {
            address: userAddress,
            stake: stake
        }, (response) => {
            console.log("Queue status:", response);
        });
    });

    socket.on('matchFound', handleMatchFound);

    socket.on('connect_error', (err) => {
        console.error("Connection Error:", err);
        statusDisplay.textContent = "Could not connect to server.";
    });
}

async function handleMatchFound(data) {
    console.log("Match found!", data);
    statusDisplay.textContent = `Match found! You are '${data.role === 'p1' ? 'X' : 'O'}'`;
    matchId = data.matchId;
    currentPlayerSymbol = data.role === 'p1' ? 'X' : 'O';
    try {
        const stake = stakeInput.value;
        const stakeInWei = ethers.parseUnits(stake, 18);
        
        statusDisplay.textContent = "Approving stake...";
        const approveTx = await gameTokenContract.approve(playGameAddress, stakeInWei);
        await approveTx.wait();
        
        statusDisplay.textContent = "Approval successful. Staking now...";
        const stakeTx = await playGameContract.stake(matchId);
        await stakeTx.wait();
        
        statusDisplay.textContent = "Stake successful! Waiting for opponent...";
        gameActive = true;
    } catch (error) {
        console.error("On-chain staking failed:", error);
        statusDisplay.textContent = "Staking failed. Please try again.";
    }
}

function handleCellPlayed(clickedCell, clickedCellIndex) {
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
        submitResult();
        return;
    }
    const roundDraw = !gameState.includes("");
    if (roundDraw) {
        statusDisplay.textContent = "Game ended in a draw!";
        gameActive = false;
        return;
    }
}

async function submitResult() {
    if (!matchId) return;
    console.log(`Submitting result for match ${matchId}. Winner: ${userAddress}`);
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
    if (!gameActive) return;
    const clickedCell = clickedCellEvent.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-cell-index'));
    if (gameState[clickedCellIndex] !== "") return;
    
    handleCellPlayed(clickedCell, clickedCellIndex);
    handleResultValidation();
}