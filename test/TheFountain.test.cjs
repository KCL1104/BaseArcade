const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TheFountain Contract", function () {
  let fountain;
  let owner;
  let user1;
  let user2;
  let user3;
  let projectWallet;
  let chromaContract;
  
  const ROUND_DURATION = 24 * 60 * 60; // 24 hours
  const ENTRY_FEE = ethers.parseEther("0.001");
  const WINNER_PERCENTAGE = 85n;
  const ROLLOVER_PERCENTAGE = 15n;

  beforeEach(async function () {
    [owner, user1, user2, user3, projectWallet, chromaContract] = await ethers.getSigners();
    
    const FountainFactory = await ethers.getContractFactory("TheFountain");
    fountain = await FountainFactory.deploy(
      projectWallet.address,
      chromaContract.address
    );
    await fountain.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct project wallet", async function () {
      expect(await fountain.projectWallet()).to.equal(projectWallet.address);
    });

    it("Should set the correct chroma contract", async function () {
      expect(await fountain.chromaContract()).to.equal(chromaContract.address);
    });

    it("Should have correct constants", async function () {
      expect(await fountain.ROUND_DURATION()).to.equal(ROUND_DURATION);
      expect(await fountain.ENTRY_FEE()).to.equal(ENTRY_FEE);
      expect(await fountain.WINNER_PERCENTAGE()).to.equal(WINNER_PERCENTAGE);
      expect(await fountain.ROLLOVER_PERCENTAGE()).to.equal(ROLLOVER_PERCENTAGE);
    });

    it("Should initialize with round 1", async function () {
      const currentRound = await fountain.getCurrentRound();
      expect(currentRound.prizePool).to.equal(0);
      expect(currentRound.isComplete).to.equal(false);
      expect(currentRound.totalParticipants).to.equal(0);
    });
  });

  describe("Coin Tossing", function () {
    it("Should allow tossing coin with correct entry fee", async function () {
      await expect(
        fountain.connect(user1).tossCoin({ value: ENTRY_FEE })
      ).to.emit(fountain, "CoinTossed")
        .withArgs(
          1, // roundId
          user1.address,
          ENTRY_FEE,
          ENTRY_FEE, // new prize pool
          await time.latest() + 1
        );
    });

    it("Should reject coin toss with insufficient fee", async function () {
      await expect(
        fountain.connect(user1).tossCoin({ value: ENTRY_FEE - 1n })
      ).to.be.revertedWith("Incorrect entry fee");
    });

    it("Should reject coin toss with excessive fee", async function () {
      await expect(
        fountain.connect(user1).tossCoin({ value: ENTRY_FEE + 1n })
      ).to.be.revertedWith("Incorrect entry fee");
    });

    it("Should prevent duplicate participation in same round", async function () {
      // First toss should succeed
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      // Second toss by same user should fail
      await expect(
        fountain.connect(user1).tossCoin({ value: ENTRY_FEE })
      ).to.be.revertedWith("Already participated in this round");
    });

    it("Should accumulate prize pool correctly", async function () {
      // Multiple users toss coins
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      await fountain.connect(user2).tossCoin({ value: ENTRY_FEE });
      await fountain.connect(user3).tossCoin({ value: ENTRY_FEE });
      
      const currentRound = await fountain.getCurrentRound();
      expect(currentRound.prizePool).to.equal(ENTRY_FEE * 3n);
      expect(currentRound.totalParticipants).to.equal(3);
    });

    it("Should prevent participation in completed round", async function () {
      // Participate in round
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      // Fast forward past round end
      await time.increase(ROUND_DURATION + 1);
      
      // Complete the round
      await fountain.selectWinner(1);
      
      // Try to participate in completed round (should fail)
      await expect(
        fountain.connect(user2).tossCoin({ value: ENTRY_FEE })
      ).to.be.revertedWith("Round has ended");
    });
  });

  describe("Winner Selection", function () {
    beforeEach(async function () {
      // Set up a round with participants
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      await fountain.connect(user2).tossCoin({ value: ENTRY_FEE });
      await fountain.connect(user3).tossCoin({ value: ENTRY_FEE });
    });

    it("Should not allow winner selection before round ends", async function () {
      await expect(
        fountain.selectWinner(1)
      ).to.be.revertedWith("Round still active");
    });

    it("Should select winner after round ends", async function () {
      // Fast forward past round end
      await time.increase(ROUND_DURATION + 1);
      
      const totalPrize = ENTRY_FEE * 3n;
      const expectedWinnerAmount = (totalPrize * WINNER_PERCENTAGE) / 100n;
      const expectedRollover = (totalPrize * ROLLOVER_PERCENTAGE) / 100n;
      
      await expect(
        fountain.selectWinner(1)
      ).to.emit(fountain, "WinnerSelected")
        .withArgs(
          1, // roundId
          await fountain.getAddress(), // winner will be one of the participants
          expectedWinnerAmount,
          expectedRollover,
          await time.latest() + 1
        );
    });

    it("Should distribute prize correctly (85% winner, 15% rollover)", async function () {
      // Fast forward past round end
      await time.increase(ROUND_DURATION + 1);
      
      const totalPrize = ENTRY_FEE * 3n;
      const expectedWinnerAmount = (totalPrize * WINNER_PERCENTAGE) / 100n;
      const expectedRollover = (totalPrize * ROLLOVER_PERCENTAGE) / 100n;
      
      const breakdown = await fountain.getPrizePoolBreakdown(1);
      expect(breakdown.winnerAmount).to.equal(expectedWinnerAmount);
      expect(breakdown.rolloverAmount).to.equal(expectedRollover);
    });

    it("Should not allow selecting winner twice", async function () {
      // Fast forward past round end
      await time.increase(ROUND_DURATION + 1);
      
      // Select winner first time
      await fountain.selectWinner(1);
      
      // Try to select winner again (should fail)
      await expect(
        fountain.selectWinner(1)
      ).to.be.revertedWith("Winner already selected");
    });

    it("Should handle round with no participants", async function () {
      // Start new round with no participants
      await time.increase(ROUND_DURATION + 1);
      
      // Try to select winner for empty round
      await expect(
        fountain.selectWinner(1)
      ).to.be.revertedWith("No participants in round");
    });
  });

  describe("Chroma Fee Integration", function () {
    it("Should accept fees from Chroma contract", async function () {
      const feeAmount = ethers.parseEther("0.0005");
      
      await expect(
        fountain.connect(chromaContract).receiveChromaFees({ value: feeAmount })
      ).to.emit(fountain, "ChromaFeesReceived")
        .withArgs(
          feeAmount,
          1, // current round
          await time.latest() + 1
        );
    });

    it("Should reject fees from non-Chroma addresses", async function () {
      const feeAmount = ethers.parseEther("0.0005");
      
      await expect(
        fountain.connect(user1).receiveChromaFees({ value: feeAmount })
      ).to.be.revertedWith("Only Chroma contract can send fees");
    });

    it("Should add Chroma fees to current round prize pool", async function () {
      const feeAmount = ethers.parseEther("0.0005");
      
      // Add some regular participants
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      const roundBefore = await fountain.getCurrentRound();
      
      // Receive Chroma fees
      await fountain.connect(chromaContract).receiveChromaFees({ value: feeAmount });
      
      const roundAfter = await fountain.getCurrentRound();
      expect(roundAfter.prizePool).to.equal(roundBefore.prizePool + feeAmount);
    });
  });

  describe("Rollover Mechanics", function () {
    it("Should carry rollover to next round", async function () {
      // Round 1: Create participants and complete
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      await fountain.connect(user2).tossCoin({ value: ENTRY_FEE });
      
      await time.increase(ROUND_DURATION + 1);
      await fountain.selectWinner(1);
      
      const round1 = await fountain.rounds(1);
      const expectedRollover = (round1.prizePool * ROLLOVER_PERCENTAGE) / 100n;
      
      // Check accumulated rollover
      expect(await fountain.accumulatedRollover()).to.equal(expectedRollover);
      
      // Round 2: New participants should benefit from rollover
      await fountain.connect(user3).tossCoin({ value: ENTRY_FEE });
      
      const round2 = await fountain.getCurrentRound();
      expect(round2.rolloverAmount).to.equal(expectedRollover);
      expect(round2.prizePool).to.equal(ENTRY_FEE + expectedRollover);
    });

    it("Should accumulate multiple rollovers", async function () {
      let totalRollover = 0n;
      
      // Complete multiple rounds
      for (let i = 1; i <= 3; i++) {
        await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
        await time.increase(ROUND_DURATION + 1);
        
        const roundBefore = await fountain.getCurrentRound();
        await fountain.selectWinner(i);
        
        const rollover = (roundBefore.prizePool * ROLLOVER_PERCENTAGE) / 100n;
        totalRollover += rollover;
        
        expect(await fountain.accumulatedRollover()).to.equal(totalRollover);
      }
    });
  });

  describe("View Functions", function () {
    it("Should return correct current round info", async function () {
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      const currentRound = await fountain.getCurrentRound();
      expect(currentRound.prizePool).to.equal(ENTRY_FEE);
      expect(currentRound.totalParticipants).to.equal(1);
      expect(currentRound.isComplete).to.equal(false);
    });

    it("Should calculate prize breakdown correctly", async function () {
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      await fountain.connect(user2).tossCoin({ value: ENTRY_FEE });
      
      const totalPrize = ENTRY_FEE * 2n;
      const breakdown = await fountain.getPrizePoolBreakdown(1);
      
      expect(breakdown.winnerAmount).to.equal((totalPrize * WINNER_PERCENTAGE) / 100n);
      expect(breakdown.rolloverAmount).to.equal((totalPrize * ROLLOVER_PERCENTAGE) / 100n);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very large prize pools", async function () {
      // Add large Chroma fees
      const largeFee = ethers.parseEther("10");
      await fountain.connect(chromaContract).receiveChromaFees({ value: largeFee });
      
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      const currentRound = await fountain.getCurrentRound();
      expect(currentRound.prizePool).to.equal(largeFee + ENTRY_FEE);
    });

    it("Should handle round transitions correctly", async function () {
      // Complete round 1
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      await time.increase(ROUND_DURATION + 1);
      await fountain.selectWinner(1);
      
      // Start round 2
      await fountain.connect(user2).tossCoin({ value: ENTRY_FEE });
      
      const round2 = await fountain.getCurrentRound();
      expect(round2.totalParticipants).to.equal(1);
      expect(round2.isComplete).to.equal(false);
    });

    it("Should handle zero rollover amounts", async function () {
      // Create a round with very small prize pool
      const smallFee = 100n; // Very small amount
      await fountain.connect(chromaContract).receiveChromaFees({ value: smallFee });
      
      await time.increase(ROUND_DURATION + 1);
      
      // Even with small amounts, rollover calculation should work
      const breakdown = await fountain.getPrizePoolBreakdown(1);
      expect(breakdown.rolloverAmount).to.equal((smallFee * ROLLOVER_PERCENTAGE) / 100n);
    });
  });
});