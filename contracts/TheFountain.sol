// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title The Fountain
 * @dev A wishing well lottery game where users toss coins for a chance to win the prize pool
 * @author Base Arcade Team
 */
contract TheFountain {
    struct Round {
        uint256 prizePool;
        uint256 startTime;
        uint256 endTime;
        address winner;
        bool isComplete;
        uint256 totalParticipants;
    }
    
    // Constants
    uint256 public constant ROUND_DURATION = 24 hours;
    uint256 public constant ENTRY_FEE = 0.001 ether;
    uint256 public constant PLATFORM_FEE_PERCENT = 5; // 5% platform fee
    uint256 public constant WINNER_PERCENTAGE = 85;
    uint256 public constant ROLLOVER_PERCENTAGE = 15;
    
    // State variables
    address public immutable projectWallet;
    uint256 public currentRoundId;
    uint256 public accumulatedRollover;
    
    // Mappings
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => bool)) public hasParticipated;
    mapping(uint256 => address[]) public roundParticipants;
    
    // Events
    event CoinTossed(
        uint256 indexed roundId,
        address indexed participant,
        uint256 entryFee,
        uint256 newPrizePool,
        uint64 timestamp
    );
    
    event WinnerSelected(
        uint256 indexed roundId,
        address indexed winner,
        uint256 prizeAmount,
        uint256 rolloverAmount,
        uint64 timestamp
    );
    
    event RoundStarted(
        uint256 indexed roundId,
        uint256 startTime,
        uint256 endTime
    );
    
    event ChromaFeesReceived(
        uint256 indexed roundId,
        uint256 amount
    );
    
    // Custom errors
    error InvalidEntryFee();
    error RoundNotActive();
    error AlreadyParticipated();
    error RoundNotEnded();
    error RoundAlreadyComplete();
    error NoParticipants();
    error TransferFailed();
    error InvalidProjectWallet();
    
    constructor(address _projectWallet) {
        if (_projectWallet == address(0)) {
            revert InvalidProjectWallet();
        }
        
        projectWallet = _projectWallet;
        currentRoundId = 1;
        accumulatedRollover = 0;
        
        // Start the first round
        _startNewRound();
    }
    
    /**
     * @dev Receive Chroma fees (called by Chroma contract)
     */
    receive() external payable {
        if (msg.value > 0) {
            Round storage round = rounds[currentRoundId];
            round.prizePool += msg.value;
            
            emit ChromaFeesReceived(currentRoundId, msg.value);
        }
    }
    
    /**
     * @dev Allows users to toss a coin and participate in the current round
     */
    function tossCoin() external payable {
        if (msg.value != ENTRY_FEE) revert InvalidEntryFee();
        
        uint256 roundId = currentRoundId;
        Round storage round = rounds[roundId];
        
        // Check if round is active
        if (block.timestamp >= round.endTime) {
            // End current round and start new one
            _endRound(roundId);
            _startNewRound();
            roundId = currentRoundId;
            round = rounds[roundId];
        }
        
        if (block.timestamp < round.startTime || block.timestamp >= round.endTime) {
            revert RoundNotActive();
        }
        
        if (hasParticipated[roundId][msg.sender]) {
            revert AlreadyParticipated();
        }
        
        // Add participant
        hasParticipated[roundId][msg.sender] = true;
        roundParticipants[roundId].push(msg.sender);
        round.totalParticipants++;
        
        // Calculate platform fee and add to prize pool
        uint256 platformFee = (msg.value * PLATFORM_FEE_PERCENT) / 100;
        uint256 prizeContribution = msg.value - platformFee;
        round.prizePool += prizeContribution;
        
        // Transfer platform fee
        (bool success, ) = projectWallet.call{value: platformFee}("");
        if (!success) revert TransferFailed();
        
        emit CoinTossed(
            roundId,
            msg.sender,
            msg.value,
            round.prizePool,
            uint64(block.timestamp)
        );
    }
    
    /**
     * @dev Manually end a round and select winner (can be called by anyone)
     */
    function endRound() external {
        uint256 roundId = currentRoundId;
        Round storage round = rounds[roundId];
        
        if (block.timestamp < round.endTime) revert RoundNotEnded();
        if (round.isComplete) revert RoundAlreadyComplete();
        
        _endRound(roundId);
        _startNewRound();
    }
    
    /**
     * @dev Internal function to end a round and select winner
     */
    function _endRound(uint256 roundId) internal {
        Round storage round = rounds[roundId];
        
        if (round.isComplete) return;
        
        address[] memory participants = roundParticipants[roundId];
        
        if (participants.length == 0) {
            round.isComplete = true;
            return;
        }
        
        // Select winner using pseudo-random selection
        uint256 randomIndex = _generateRandomNumber(participants.length, roundId);
        address winner = participants[randomIndex];
        
        round.winner = winner;
        round.isComplete = true;
        
        // Add accumulated rollover to current prize pool
        uint256 totalPrizePool = round.prizePool + accumulatedRollover;
        
        // Calculate platform fee from entry fees only (not from rollover)
        uint256 platformFee = (round.prizePool * PLATFORM_FEE_PERCENT) / 100;
        
        // Calculate winner amount (85% of total pool after platform fee)
        uint256 availableForDistribution = totalPrizePool - platformFee;
        uint256 winnerAmount = (availableForDistribution * WINNER_PERCENTAGE) / 100;
        uint256 rolloverAmount = availableForDistribution - winnerAmount;
        
        // Transfer platform fee to project wallet
        (bool feeSuccess, ) = projectWallet.call{value: platformFee}("");
        if (!feeSuccess) {
            revert TransferFailed();
        }
        
        // Transfer prize to winner
        if (winnerAmount > 0) {
            (bool success, ) = winner.call{value: winnerAmount}("");
            if (!success) revert TransferFailed();
        }
        
        // Update accumulated rollover for next round
        accumulatedRollover = rolloverAmount;
        
        emit WinnerSelected(
            roundId,
            winner,
            winnerAmount,
            rolloverAmount,
            uint64(block.timestamp)
        );
    }
    
    /**
     * @dev Start a new round
     */
    function _startNewRound() internal {
        currentRoundId++;
        uint256 roundId = currentRoundId;
        
        rounds[roundId] = Round({
            prizePool: accumulatedRollover,
            startTime: block.timestamp,
            endTime: block.timestamp + ROUND_DURATION,
            winner: address(0),
            isComplete: false,
            totalParticipants: 0
        });
        
        // Reset accumulated rollover since it's now part of the new round
        accumulatedRollover = 0;
        
        emit RoundStarted(
            roundId,
            block.timestamp,
            block.timestamp + ROUND_DURATION
        );
    }
    
    /**
     * @dev Generate pseudo-random number for winner selection
     */
    function _generateRandomNumber(uint256 max, uint256 roundId) internal view returns (uint256) {
        return uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    roundId,
                    msg.sender
                )
            )
        ) % max;
    }
    
    // View functions
    
    /**
     * @dev Get current round information
     */
    function getCurrentRound() external view returns (Round memory) {
        return rounds[currentRoundId];
    }
    
    /**
     * @dev Get round information by ID
     */
    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }
    
    /**
     * @dev Get participants for a specific round
     */
    function getRoundParticipants(uint256 roundId) external view returns (address[] memory) {
        return roundParticipants[roundId];
    }
    
    /**
     * @dev Check if user has participated in a round
     */
    function hasUserParticipated(uint256 roundId, address user) external view returns (bool) {
        return hasParticipated[roundId][user];
    }
    
    /**
     * @dev Get time remaining in current round
     */
    function getTimeRemaining() external view returns (uint256) {
        Round memory round = rounds[currentRoundId];
        if (block.timestamp >= round.endTime) {
            return 0;
        }
        return round.endTime - block.timestamp;
    }
    
    /**
     * @dev Get total number of rounds
     */
    function getTotalRounds() external view returns (uint256) {
        return currentRoundId;
    }
    
    /**
     * @dev Get game statistics
     */
    function getGameStats() external view returns (
        uint256 totalRounds,
        uint256 totalParticipants,
        uint256 totalPrizesPaid
    ) {
        totalRounds = currentRoundId;
        totalParticipants = 0;
        totalPrizesPaid = 0;
        
        for (uint256 i = 1; i <= currentRoundId; i++) {
            Round memory round = rounds[i];
            totalParticipants += round.totalParticipants;
            if (round.isComplete && round.winner != address(0)) {
                totalPrizesPaid += round.prizePool;
            }
        }
    }
    
    /**
     * @dev Get current accumulated rollover amount
     * @return Current rollover amount
     */
    function getAccumulatedRollover() external view returns (uint256) {
        return accumulatedRollover;
    }
    
    /**
     * @dev Get prize breakdown for current round
     * @return totalPool Total prize pool including rollover
     * @return winnerAmount Amount that will go to winner (85%)
     * @return rolloverAmount Amount that will rollover to next round (15%)
     * @return platformFee Platform fee amount
     */
    function getCurrentPrizeBreakdown() external view returns (
        uint256 totalPool,
        uint256 winnerAmount,
        uint256 rolloverAmount,
        uint256 platformFee
    ) {
        Round storage round = rounds[currentRoundId];
        totalPool = round.prizePool + accumulatedRollover;
        
        platformFee = (round.prizePool * PLATFORM_FEE_PERCENT) / 100;
        uint256 availableForDistribution = totalPool - platformFee;
        
        winnerAmount = (availableForDistribution * WINNER_PERCENTAGE) / 100;
        rolloverAmount = availableForDistribution - winnerAmount;
    }
}