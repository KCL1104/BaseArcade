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
  
  const ROUND_DURATION = 24 * 60 * 60; // 24 hours
  const ENTRY_FEE = ethers.parseEther("0.001");
  const PLATFORM_FEE_PERCENT = 5;
  const WINNER_PERCENTAGE = 85n;
  const ROLLOVER_PERCENTAGE = 15n;

  beforeEach(async function () {
    [owner, user1, user2, user3, projectWallet] = await ethers.getSigners();
    
    const FountainFactory = await ethers.getContractFactory("TheFountain");
    fountain = await FountainFactory.deploy(projectWallet.address);
    await fountain.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct project wallet", async function () {
      expect(await fountain.projectWallet()).to.equal(projectWallet.address);
    });

    it("Should have correct constants", async function () {
      expect(await fountain.ROUND_DURATION()).to.equal(ROUND_DURATION);
      expect(await fountain.ENTRY_FEE()).to.equal(ENTRY_FEE);
      expect(await fountain.PLATFORM_FEE_PERCENT()).to.equal(PLATFORM_FEE_PERCENT);
      expect(await fountain.WINNER_PERCENTAGE()).to.equal(WINNER_PERCENTAGE);
      expect(await fountain.ROLLOVER_PERCENTAGE()).to.equal(ROLLOVER_PERCENTAGE);
    });

    it("Should initialize with round 2", async function () {
      expect(await fountain.currentRoundId()).to.equal(2);
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
      ).to.emit(fountain, "CoinTossed");
    });

    it("Should reject coin toss with insufficient fee", async function () {
      await expect(
        fountain.connect(user1).tossCoin({ value: ENTRY_FEE - 1n })
      ).to.be.revertedWithCustomError(fountain, "InvalidEntryFee");
    });

    it("Should reject coin toss with excessive fee", async function () {
      await expect(
        fountain.connect(user1).tossCoin({ value: ENTRY_FEE + 1n })
      ).to.be.revertedWithCustomError(fountain, "InvalidEntryFee");
    });

    it("Should prevent duplicate participation in same round", async function () {
      // First toss should succeed
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      // Second toss by same user should fail
      await expect(
        fountain.connect(user1).tossCoin({ value: ENTRY_FEE })
      ).to.be.revertedWithCustomError(fountain, "AlreadyParticipated");
    });

    it("Should accumulate prize pool correctly", async function () {
      // Multiple users toss coins
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      await fountain.connect(user2).tossCoin({ value: ENTRY_FEE });
      await fountain.connect(user3).tossCoin({ value: ENTRY_FEE });
      
      const currentRound = await fountain.getCurrentRound();
      // Prize pool should be entry fees minus platform fees (5% each)
      const expectedPrizePool = (ENTRY_FEE * 3n * 95n) / 100n;
      expect(currentRound.prizePool).to.equal(expectedPrizePool);
      expect(currentRound.totalParticipants).to.equal(3);
    });
  });

  describe("Round Management", function () {
    it("Should end round manually", async function () {
      // Participate in round
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      // Fast forward past round end
      await time.increase(ROUND_DURATION + 1);
      
      // End the round manually
      await expect(
        fountain.endRound()
      ).to.emit(fountain, "WinnerSelected");
    });

    it("Should handle round with no participants", async function () {
      // Fast forward past round end without participants
      await time.increase(ROUND_DURATION + 1);
      
      // End the round
      await fountain.endRound();
      
      // Should start new round
      expect(await fountain.currentRoundId()).to.equal(3);
    });
  });

  describe("Fee Integration", function () {
    it("Should accept fees via receive function", async function () {
      const feeAmount = ethers.parseEther("0.0005");
      
      await expect(
        user1.sendTransaction({ to: await fountain.getAddress(), value: feeAmount })
      ).to.emit(fountain, "ChromaFeesReceived");
    });

    it("Should add received fees to current round prize pool", async function () {
      const feeAmount = ethers.parseEther("0.0005");
      
      const roundBefore = await fountain.getCurrentRound();
      
      // Send fees to contract
      await user1.sendTransaction({ to: await fountain.getAddress(), value: feeAmount });
      
      const roundAfter = await fountain.getCurrentRound();
      expect(roundAfter.prizePool).to.equal(roundBefore.prizePool + feeAmount);
    });
  });

  describe("View Functions", function () {
    it("Should return correct current round info", async function () {
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      const currentRound = await fountain.getCurrentRound();
      expect(currentRound.totalParticipants).to.equal(1);
      expect(currentRound.isComplete).to.equal(false);
    });

    it("Should return correct time remaining", async function () {
      const timeRemaining = await fountain.getTimeRemaining();
      expect(timeRemaining).to.be.gt(0);
      expect(timeRemaining).to.be.lte(ROUND_DURATION);
    });

    it("Should return correct prize breakdown", async function () {
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      const breakdown = await fountain.getCurrentPrizeBreakdown();
      expect(breakdown.totalPool).to.be.gt(0);
      expect(breakdown.winnerAmount).to.be.gt(0);
      expect(breakdown.rolloverAmount).to.be.gt(0);
      expect(breakdown.platformFee).to.be.gt(0);
    });

    it("Should return game statistics", async function () {
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      const stats = await fountain.getGameStats();
      expect(stats.totalRounds).to.equal(2);
      expect(stats.totalParticipants).to.equal(1);
    });
  });

  describe("Rollover Mechanics", function () {
    it("Should handle rollover correctly", async function () {
      // Participate in round
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      // End round
      await time.increase(ROUND_DURATION + 1);
      await fountain.endRound();
      
      // Check that new round has rollover
      const newRound = await fountain.getCurrentRound();
      expect(newRound.prizePool).to.be.gt(0); // Should have rollover amount
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very large prize pools", async function () {
      // Add large fees
      const largeFee = ethers.parseEther("10");
      await user1.sendTransaction({ to: await fountain.getAddress(), value: largeFee });
      
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      
      const currentRound = await fountain.getCurrentRound();
      expect(currentRound.prizePool).to.be.gt(largeFee);
    });

    it("Should handle round transitions correctly", async function () {
      // Complete round 2
      await fountain.connect(user1).tossCoin({ value: ENTRY_FEE });
      await time.increase(ROUND_DURATION + 1);
      await fountain.endRound();
      
      // Start round 3
      await fountain.connect(user2).tossCoin({ value: ENTRY_FEE });
      
      const round3 = await fountain.getCurrentRound();
      expect(round3.totalParticipants).to.equal(1);
      expect(round3.isComplete).to.equal(false);
    });
  });
});