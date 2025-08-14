import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { GameToken, TokenStore, PlayGame } from "../typechain-types";

describe("PlayGame Contract E2E Flow", function () {
    let gameToken: GameToken;
    let tokenStore: TokenStore;
    let playGame: PlayGame;
    let owner: Signer;
    let player1: Signer;
    let player2: Signer;
    let operator: Signer;

    const stakeAmount = ethers.parseUnits("10", 18); // 10 GT with 18 decimals

    before(async function () {
        [owner, player1, player2, operator] = await ethers.getSigners();

        // 1. DEPLOY Contracts
        const GameTokenFactory = await ethers.getContractFactory("GameToken");
        gameToken = await GameTokenFactory.deploy();

        const TokenStoreFactory = await ethers.getContractFactory("TokenStore");
        tokenStore = await TokenStoreFactory.deploy(
            ethers.ZeroAddress,
            await gameToken.getAddress()
        );

        const PlayGameFactory = await ethers.getContractFactory("PlayGame");
        playGame = await PlayGameFactory.deploy(
            await gameToken.getAddress(),
            await operator.getAddress()
        );

        // --- SETUP ---
        // <<< FIX: MINT TOKENS FOR PLAYERS FIRST
        // While the original 'owner' still has minting rights on GameToken...
        await gameToken.connect(owner).mint(await player1.getAddress(), stakeAmount);
        await gameToken.connect(owner).mint(await player2.getAddress(), stakeAmount);

        // <<< FIX: THEN TRANSFER OWNERSHIP TO TOKENSTORE
        // Now lock down minting so only TokenStore can do it.
        await gameToken.transferOwnership(await tokenStore.getAddress());
    });

    it("should allow players to create a match, stake, and a winner to receive the prize", async function () {
        // <<< The minting lines are removed from here, as it's now done in the 'before' block.
        
        const matchId = ethers.id("match1");

        // 1. Operator creates the match
        await playGame.connect(operator).createMatch(
            matchId,
            await player1.getAddress(),
            await player2.getAddress(),
            stakeAmount
        );

        // 2. Players must APPROVE the PlayGame contract to spend their tokens
        await gameToken.connect(player1).approve(await playGame.getAddress(), stakeAmount);
        await gameToken.connect(player2).approve(await playGame.getAddress(), stakeAmount);

        // 3. Players call the stake function
        await playGame.connect(player1).stake(matchId);
        await playGame.connect(player2).stake(matchId);

        // 4. Operator commits the result
        await playGame.connect(operator).commitResult(matchId, await player1.getAddress());

        // --- VERIFICATION ---
        // Check Player 1's (winner) final balance. They started with 10, staked 10 (balance 0), and won 20.
        const player1FinalBalance = await gameToken.balanceOf(await player1.getAddress());
        expect(player1FinalBalance).to.equal(ethers.parseUnits("20", 18));

        // Check Player 2's (loser) final balance. They started with 10, staked 10, and lost.
        const player2FinalBalance = await gameToken.balanceOf(await player2.getAddress());
        expect(player2FinalBalance).to.equal(0);
    });
});