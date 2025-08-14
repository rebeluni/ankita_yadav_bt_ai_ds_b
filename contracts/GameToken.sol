// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice We are importing two standard, secure contracts from the OpenZeppelin library.
 * ERC20.sol is the template for a standard token.
 * Ownable.sol gives us tools to manage contract ownership.
 */
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GameToken
 * @dev An ERC-20 token with 18 decimals.
 * The key rule is that only the owner of this contract can create (mint) new tokens.
 * This is required so that only our TokenStore can issue new GT.
 */
contract GameToken is ERC20, Ownable {
    /**
     * @dev The constructor is a special function that runs only once when the contract is deployed.
     * Here, we are setting the token's name to "GameToken" and its symbol to "GT".
     * We also set the initial owner to be the person who deploys the contract.
     */
    constructor() ERC20("GameToken", "GT") Ownable(msg.sender) {}

    /**
     * @dev This function creates `amount` new tokens and assigns them to the `to` address.
     * The `onlyOwner` modifier ensures that only the contract's owner can call this function.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount); // This is the internal function from ERC20.sol that does the minting.
    }
}