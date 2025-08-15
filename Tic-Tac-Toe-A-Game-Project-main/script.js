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
// I have removed them for brevity, but your file should have them.
const gameTokenAddress = "0x2FE6ad84f58A05D542D587b84DfE3ea8009544D5";
const playGameAddress = "0x7ee5A3B438a0688dF12608839cE7A8B6279BA858";
const gameTokenABI = [/* PASTE YOUR FULL GAMETOKEN ABI HERE */];
const playGameABI = [/* PASTE YOUR FULL PLAYGAME ABI HERE */];

// Initialize Socket.IO with auto-reconnect and the required auth token
function initializeSocket() {
    if (socket?.connected) socket.disconnect();

    // *** THIS IS THE FIX ***
    // We add the 'auth' property with the user's wallet address.
    socket = io(RENDER_URL, {
        path: "/socket.io/",
        transports: ["websocket"],
        auth: { token: userAddress }, // This line was missing
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

    // Keepalive ping every 15 seconds
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
        
        // Initialize socket AFTER wallet connection so we have the address
        initializeSocket();
        
        // Handle network changes
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
        initializeSocket(); // Attempt to reconnect if not connected
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

async function handleMatchFound(data) {
    console.log("Match found:", data);
    matchId = data.matchId;
    currentPlayerSymbol = data.role === 'p1' ? 'X' : 'O';
    statusDisplay.textContent = `Matched! You're ${currentPlayerSymbol}. Staking...`;

    try {
        // Approve and stake
        const stakeAmount = ethers.parseUnits(stakeInput.value, 18);
        
        statusDisplay.textContent = "Approving tokens...";
        const approveTx = await gameTokenContract.approve(playGameAddress, stakeAmount);
        await approveTx.wait();
        
        statusDisplay.textContent = "Staking tokens...";
        const stakeTx = await playGameContract.stake(matchId);
        await stakeTx.wait();
        
        gameActive = true;
        statusDisplay.textContent = `Your turn (${currentPlayerSymbol})`;
    } catch (error) {
        console.error("Staking failed:", error);
        statusDisplay.textContent = "Staking failed. Refresh and retry.";
    }
}

// Game board functions remain unchanged
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
            body: JSON.stringify({ 
                matchId, 
                winner: userAddress 
            })
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

// Event listeners
connectButton.addEventListener('click', connectWallet);
findMatchButton.addEventListener('click', findMatch);
cells.forEach(cell => cell.addEventListener('click', handleCellClick));

// Initialize network alert
const networkAlert = document.createElement('div');
networkAlert.id = 'network-alert';
networkAlert.style.cssText = 'display:none;padding:10px;background:#ffeb3b;margin:10px 0;text-align:center;';
networkAlert.innerHTML = '⚠️ Please switch to <strong>Sepolia Testnet</strong> in MetaMask';
document.querySelector('section').prepend(networkAlert);

// Network detection
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