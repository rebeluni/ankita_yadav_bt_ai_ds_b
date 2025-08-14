import { ethers } from "hardhat";

async function main() {
    console.log("Deploying contracts...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // You might need a real USDT address on the testnet you use,
    // or you can deploy a mock ERC20 token for testing.
    // For Sepolia testnet, a common mock USDT is: 0x... (find one on a block explorer)
    // For now, we'll use a placeholder.
    const mockUsdtAddress = "0x7439e9bb6d4a82436142329735a42226231642be"; // A mock address // A mock address

    // 1. Deploy GameToken
    const gameToken = await ethers.deployContract("GameToken");
    await gameToken.waitForDeployment();
    const gameTokenAddress = await gameToken.getAddress();
    console.log(`GameToken deployed to: ${gameTokenAddress}`);

    // 2. Deploy TokenStore
    const tokenStore = await ethers.deployContract("TokenStore", [
        mockUsdtAddress,
        gameTokenAddress,
    ]);
    await tokenStore.waitForDeployment();
    const tokenStoreAddress = await tokenStore.getAddress();
    console.log(`TokenStore deployed to: ${tokenStoreAddress}`);

    // 3. Deploy PlayGame
    const playGame = await ethers.deployContract("PlayGame", [
        gameTokenAddress,
        deployer.address, // We'll use the deployer as the operator for now
    ]);
    await playGame.waitForDeployment();
    const playGameAddress = await playGame.getAddress();
    console.log(`PlayGame deployed to: ${playGameAddress}`);

    // 4. Post-deployment setup: Transfer GameToken ownership to TokenStore
    console.log("Transferring GameToken ownership to TokenStore...");
    const tx = await gameToken.transferOwnership(tokenStoreAddress);
    await tx.wait();
    console.log("Ownership transferred successfully.");

    console.log("--- Deployment Complete ---");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});