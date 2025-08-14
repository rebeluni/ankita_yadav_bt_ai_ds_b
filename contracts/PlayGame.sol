// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PlayGame is ReentrancyGuard {
    enum MatchStatus { CREATED, STAKED, SETTLED, REFUNDED }

    struct Match {
        address player1;
        address player2;
        uint256 stakeAmount;
        MatchStatus status;
        bool p1_staked;
        bool p2_staked;
        uint256 startTime;
    }

    IERC20 public immutable gameToken;
    address public operator;
    uint256 public constant REFUND_TIMEOUT = 24 hours;

    mapping(bytes32 => Match) public matches;

    event MatchCreated(bytes32 indexed matchId, address indexed p1, address indexed p2, uint256 stake);
    event Staked(bytes32 indexed matchId, address indexed player);
    event Settled(bytes32 indexed matchId, address indexed winner, uint256 prize);
    event Refunded(bytes32 indexed matchId);

    modifier onlyOperator() {
        require(msg.sender == operator, "Caller is not the operator");
        _;
    }

    constructor(address _gameTokenAddress, address _operatorAddress) {
        gameToken = IERC20(_gameTokenAddress);
        operator = _operatorAddress;
    }

    function createMatch(bytes32 matchId, address p1, address p2, uint256 _stake) external onlyOperator {
        require(matches[matchId].stakeAmount == 0, "Match already exists");
        matches[matchId] = Match(p1, p2, _stake, MatchStatus.CREATED, false, false, 0);
        emit MatchCreated(matchId, p1, p2, _stake);
    }

    function stake(bytes32 matchId) external nonReentrant {
        Match storage currentMatch = matches[matchId];
        require(msg.sender == currentMatch.player1 || msg.sender == currentMatch.player2, "Not a player");
        
        if (msg.sender == currentMatch.player1) require(!currentMatch.p1_staked, "Already staked");
        else require(!currentMatch.p2_staked, "Already staked");

        gameToken.transferFrom(msg.sender, address(this), currentMatch.stakeAmount);

        if (msg.sender == currentMatch.player1) currentMatch.p1_staked = true;
        else currentMatch.p2_staked = true;
        
        emit Staked(matchId, msg.sender);

        if (currentMatch.p1_staked && currentMatch.p2_staked) {
            currentMatch.status = MatchStatus.STAKED;
            currentMatch.startTime = block.timestamp;
        }
    }

    function commitResult(bytes32 matchId, address winner) external onlyOperator nonReentrant {
        Match storage currentMatch = matches[matchId];
        require(currentMatch.status == MatchStatus.STAKED, "Match not in STAKED state");
        require(winner == currentMatch.player1 || winner == currentMatch.player2, "Invalid winner");
        
        currentMatch.status = MatchStatus.SETTLED;
        uint256 prize = currentMatch.stakeAmount * 2;
        gameToken.transfer(winner, prize);
        
        emit Settled(matchId, winner, prize);
    }

    function refund(bytes32 matchId) external nonReentrant {
        Match storage currentMatch = matches[matchId];
        require(currentMatch.status == MatchStatus.STAKED, "Match not in STAKED state");
        require(block.timestamp > currentMatch.startTime + REFUND_TIMEOUT, "Timeout not passed");

        currentMatch.status = MatchStatus.REFUNDED;
        
        if (currentMatch.p1_staked) gameToken.transfer(currentMatch.player1, currentMatch.stakeAmount);
        // <<< THE FINAL TYPO 'currentMymatch' IS NOW CORRECTED TO 'currentMatch' HERE
        if (currentMatch.p2_staked) gameToken.transfer(currentMatch.player2, currentMatch.stakeAmount);
        
        emit Refunded(matchId);
    }
}