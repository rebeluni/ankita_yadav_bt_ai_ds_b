# TriX - PvP Gaming Staking Platform

This project is a complete blockchain-based incentive and reward distribution system for Player vs. Player (PvP) gaming. [cite_start]It was built to fulfill the requirements of the WeSeeGPT technical assessment dated August 12, 2025[cite: 76].

## 1. System Overview

[cite_start]The primary purpose of the TriX system is to provide a trustless environment for match staking between two players[cite: 1]. [cite_start]It ensures the transparent and secure transfer of staked tokens to the winner and allows players to purchase in-game tokens (GameToken or GT) using USDT[cite: 1].

The core functionalities are:
* [cite_start]**Game Token (GT) Purchase**: Players can buy GT using USDT through the `TokenStore` contract[cite: 1].
* [cite_start]**Match Staking**: Two players stake an equal amount of GT, which is held in escrow by the `PlayGame` contract[cite: 1].
* [cite_start]**Winner Payout**: A trusted game server, via an API gateway, confirms the winner, and the smart contract automatically transfers the entire staked pot to them[cite: 1].

## 2. Architecture

The project consists of four main components that work together:

* **Smart Contracts (on-chain)**: The core logic written in Solidity and deployed on the blockchain.
* **Backend API (off-chain)**: A Node.js server that acts as the trusted operator for creating matches and reporting results.
* **Frontend (off-chain)**: A basic web interface for an operator to interact with the backend API.
* **Indexer/Leaderboard (off-chain)**: A standalone script that listens to blockchain events to build and serve a player leaderboard.

## 3. What's in the ZIP File

[cite_start]This submission includes all the required components for Round 1[cite: 91]:

* `contracts/`: Contains the 3 Solidity smart contracts and the Hardhat deployment script.
* `api/`: Contains the Node.js/Express backend application with the required API endpoints. Includes a `.env.example` file.
* `web/`: Contains the basic `index.html` and `script.js` for the frontend.
* `tools/`: Contains the `leaderboard.js` event listener and API server.
* `README.md`: This file, explaining the project architecture and setup instructions.
* `VIDEO`: A link to a 2-3 minute explanation video will be included here.

---

## 4. How to Run

This project is a monorepo containing several parts. You will need multiple terminals to run everything simultaneously.

### **Part A: Smart Contracts**

This project uses the Hardhat development environment.

1.  **Install Dependencies** (from the root `TrixProject` folder):
    ```bash
    npm install
    ```
2.  **Compile Contracts**:
    ```bash
    npx hardhat compile
    ```
3.  **Run Tests**:
    ```bash
    npx hardhat test
    ```
4.  **Deploy**:
    * Fill in your `RPC_URL` and `OPERATOR_PRIVATE_KEY` in a `.env` file in the project root.
    * Run the deployment script (replace `sepolia` with your target network if different).
    ```bash
    npx hardhat run scripts/deploy.ts --network sepolia
    ```
    * After deployment, copy the contract addresses into your `.env` file.

### **Part B: Backend API**

The API server connects to the deployed contracts and acts as the operator.

1.  **Navigate to the API directory**:
    ```bash
    cd api
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Start the server**:
    ```bash
    node index.js
    ```
    The server will run on `http://localhost:3000`.

### **Part C: Leaderboard Tool**

The leaderboard listens to contract events and serves a top-10 list.

1.  **Navigate to the tools directory**:
    ```bash
    cd tools
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Start the indexer**:
    ```bash
    node leaderboard.js
    ```
    The leaderboard API will run on `http://localhost:4000/leaderboard`.

### **Part D: Frontend**

The frontend is a simple HTML file that interacts with the backend API. It does not have a build step.

* Simply open the `index.html` file from the `web/` directory in a web browser.
