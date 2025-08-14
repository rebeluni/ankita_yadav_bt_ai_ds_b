// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // <<< THIS LINE IS NOW CORRECT
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GameToken.sol";

/**
 * @title TokenStore
 * @dev This contract sells GameTokens (GT) to users in exchange for USDT.
 * It is the owner of the GameToken contract to have exclusive minting rights.
 */
contract TokenStore is Ownable, ReentrancyGuard {
    // State variables that are set once and never change. `immutable` saves gas.
    IERC20 public immutable usdt;
    GameToken public immutable gameToken;
    uint256 public immutable gtPerUsdt;

    // An event to log all purchases, making them easy to track on the blockchain.
    event Purchase(address indexed buyer, uint256 usdtAmount, uint256 gtout);

    /**
     * @dev The constructor initializes the contract with the addresses of the USDT and GameToken contracts.
     * @param _usdtAddress The blockchain address of the USDT token contract.
     * @param _gameTokenAddress The address of our GameToken contract we just deployed.
     */
    constructor(address _usdtAddress, address _gameTokenAddress) Ownable(msg.sender) {
        usdt = IERC20(_usdtAddress);
        gameToken = GameToken(_gameTokenAddress);
        // The rate is set to 1e18. This accounts for the decimal difference between USDT (6 decimals)
        // and our GT (18 decimals) to maintain a 1:1 value ratio.
        gtPerUsdt = 1e18;
    }

    /**
     * @dev Allows a user to buy GT by spending their USDT.
     * IMPORTANT: The user must first approve this contract to spend their USDT on their behalf.
     * @param usdtAmount The amount of USDT (with 6 decimals) the user wants to spend.
     */
    function buy(uint256 usdtAmount) external nonReentrant {
        // Calculate the amount of GT to mint. We divide by 1e6 to normalize USDT's 6 decimals.
        uint256 gtout = (usdtAmount * gtPerUsdt) / 1e6;
        require(gtout > 0, "GT amount would be zero");

        // --- Checks-Effects-Interactions Pattern for Security ---

        // 1. Checks: Pull the specified USDT amount from the user to this contract.
        // This call will fail if the user has not approved the spending.
        usdt.transferFrom(msg.sender, address(this), usdtAmount);

        // 2. Effects: If the USDT transfer was successful, mint the calculated GT amount to the user.
        gameToken.mint(msg.sender, gtout);

        // 3. Interactions: Emit an event to log the successful purchase.
        emit Purchase(msg.sender, usdtAmount, gtout);
    }
    
    /**
     * @dev A helper function to be called by the owner after deployment.
     * This transfers the ownership of the GameToken contract to this TokenStore contract.
     * This is the final step to ensure ONLY TokenStore can mint new GT.
     */
    function setGameTokenOwner() external onlyOwner {
        gameToken.transferOwnership(address(this));
    }
}