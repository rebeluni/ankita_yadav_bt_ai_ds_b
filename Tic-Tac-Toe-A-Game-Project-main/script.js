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

const RENDER_URL = "https://trix-backend-server.onrender.com";
const API_URL = RENDER_URL;

// IMPORTANT: You must include your full ABIs here for the code to work.
const gameTokenAddress = "0x2FE6ad84f58A05D542D587b84DfE3ea8009544D5";
const playGameAddress = "0x7ee5A3B438a0688dF12608839cE7A8B6279BA858";
const gameTokenABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"allowance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientAllowance","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientBalance","type":"error"},{"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC20InvalidApprover","type":"error"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC20InvalidReceiver","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC20InvalidSender","type":"error"},{"inputs":[{"internalType":"address","name":"spender","type":"address"}],"name":"ERC20InvalidSpender","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];
const playGameABI = [{"inputs":[{"internalType":"address","name":"_gameTokenAddress","type":"address"},{"internalType":"address","name":"_operatorAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"p1","type":"address"},{"indexed":true,"internalType":"address","name":"p2","type":"address"},{"indexed":false,"internalType":"uint256","name":"stake","type":"uint256"}],"name":"MatchCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"}],"name":"Refunded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"winner","type":"address"},{"indexed":false,"internalType":"uint256","name":"prize","type":"uint256"}],"name":"Settled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"matchId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"player","type":"address"}],"name":"Staked","type":"event"},{"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"},{"internalType":"address","name":"winner","type":"address"}],"name":"commitResult","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"},{"internalType":"address","name":"p1","type":"address"},{"internalType":"address","name":"p2","type":"address"},{"internalType":"uint256","name":"_stake","type":"uint256"}],"name":"createMatch","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"gameToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"matches","outputs":[{"internalType":"address","name":"player1","type":"address"},{"internalType":"address","name":"player2","type":"address"},{"internalType":"uint256","name":"stakeAmount","type":"uint256"},{"internalType":"enum PlayGame.MatchStatus","name":"status","type":"uint8"},{"internalType":"bool","name":"p1_staked","type":"bool"},{"internalType":"bool","name":"p2_staked","type":"bool"},{"internalType":"uint256","name":"startTime","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"operator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"}],"name":"refund","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"matchId","type":"bytes32"}],"name":"stake","outputs":[],"stateMutability":"nonpayable","type":"function"}];

function initializeSocket() {
    if (socket?.connected) socket.disconnect();

    socket = io(RENDER_URL, {
        path: "/socket.io/",
        transports: ["websocket"],
        auth: { token: userAddress },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        timeout: 20000
    });

    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        statusDisplay.textContent = 'Connected. Ready to find a match.';
    });

    socket.on('matchFound', handleMatchFound);
    socket.on('gameReady', handleGameReady); // New listener
    socket.on('opponentStakingFailed', handleOpponentStakingFailed); // New listener
    
    socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        if (reason !== 'io client disconnect') {
            statusDisplay.textContent = 'Connection lost. Please refresh.';
        }
    });

    socket.on('connect_error', (err) => {
        console.error("Connection error:", err.message);
        statusDisplay.textContent = `Could not connect to server.`;
    });

    setInterval(() => {
        if (socket?.connected) socket.emit('ping');
    }, 15000);
}

async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        statusDisplay.textContent = "Please install MetaMask!";
        return;
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
        
        initializeSocket();
        
        window.ethereum.on('chainChanged', () => window.location.reload());
        
    } catch (error) {
        console.error("Wallet connection failed:", error);
        statusDisplay.textContent = "Connection failed. Try again.";
    }
}

function findMatch() {
    if (!signer) return alert("Connect wallet first");
    if (!socket || !socket.connected) {
        statusDisplay.textContent = "Connecting to server...";
        initializeSocket();
        return;
    }
    const stake = stakeInput.value;
    
    if (!stake || isNaN(stake) || stake <= 0) {
        return alert("Enter valid stake amount (GT)");
    }

    statusDisplay.textContent = `Finding match (${stake} GT)...`;
    
    socket.emit("joinQueue", { stake }, (response) => {
        if (response?.error) {
            statusDisplay.textContent = response.error;
        } else if (response?.status === 'waiting') {
            statusDisplay.textContent = `Waiting for opponent (${stake} GT)...`;
        }
    });
}

// New, robust staking flow as per advice
async function handleMatchFound(data) {
    console.log("Match found:", data);
    matchId = data.matchId;
    currentPlayerSymbol = data.role === 'p1' ? 'X' : 'O';
    statusDisplay.textContent = `Matched! You're ${currentPlayerSymbol}. Approving tokens...`;

    try {
        const stakeAmount = ethers.parseUnits(stakeInput.value, 18);
        
        const approveTx = await gameTokenContract.approve(playGameAddress, stakeAmount);
        await approveTx.wait();
        
        statusDisplay.textContent = "Approval successful. Staking now...";
        
        const stakeTx = await playGameContract.stake(matchId);
        await stakeTx.wait();
        
        // Notify server that this client has completed staking
        socket.emit('stakingComplete', { matchId });
        statusDisplay.textContent = `Staked! Waiting for opponent...`;

    } catch (error) {
        console.error("Staking failed:", error);
        statusDisplay.textContent = "Staking failed. Refresh and retry.";
        socket.emit('stakingFailed', { matchId });
    }
}

// New handler for when the server confirms both players have staked
function handleGameReady({ matchId: serverMatchId }) {
    if (matchId === serverMatchId) {
        gameActive = true;
        statusDisplay.textContent = `Game started! Your turn (${currentPlayerSymbol})`;
    }
}

function handleOpponentStakingFailed() {
    statusDisplay.textContent = "Opponent failed to stake. Find a new match.";
    // Reset UI state
    matchId = "";
    gameActive = false;
    gameState = ["", "", "", "", "", "", "", "", ""];
    cells.forEach(cell => cell.innerHTML = "");
}

function handleCellPlayed(clickedCell, clickedCellIndex) {
    gameState[clickedCellIndex] = currentPlayerSymbol;
    clickedCell.innerHTML = currentPlayerSymbol;
}

function handleResultValidation() {
    let roundWon = false;
    for (const condition of winningConditions) {
        const [a, b, c] = condition.map(i => gameState[i]);
        if (a && a === b && a === c) {
            roundWon = true;
            break;
        }
    }

    if (roundWon) {
        gameActive = false;
        return submitResult();
    }

    if (!gameState.includes("")) {
        gameActive = false;
        statusDisplay.textContent = "Game drawn!";
    }
}

async function submitResult() {
    if (!matchId) return;
    
    try {
        statusDisplay.textContent = "Submitting result...";
        const response = await fetch(`${API_URL}/match/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, winner: userAddress })
        });
        
        const data = await response.json();
        if (data.txHash) {
            statusDisplay.innerHTML = `You won! <a href="https://sepolia.etherscan.io/tx/${data.txHash}" target="_blank">View transaction</a>`;
        } else {
            statusDisplay.textContent = data.error || "Result submitted, but no tx hash returned.";
        }
    } catch (error) {
        console.error("Result submission failed:", error);
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

connectButton.addEventListener('click', connectWallet);
findMatchButton.addEventListener('click', findMatch);
cells.forEach(cell => cell.addEventListener('click', handleCellClick));

const networkAlert = document.createElement('div');
networkAlert.id = 'network-alert';
networkAlert.style.cssText = 'display:none;padding:10px;background:#ffeb3b;margin:10px 0;text-align:center;';
networkAlert.innerHTML = '⚠️ Please switch to <strong>Sepolia Testnet</strong> in MetaMask';
document.querySelector('section').prepend(networkAlert);

if (window.ethereum) {
    const checkNetwork = async () => {
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            networkAlert.style.display = chainId === '0xaa36a7' ? 'none' : 'block';
        } catch (error) {
            console.error("Could not check network:", error);
        }
    };
    window.ethereum.on('chainChanged', checkNetwork);
    checkNetwork();
}
