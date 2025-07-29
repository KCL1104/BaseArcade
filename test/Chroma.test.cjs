const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Chroma Contract", function () {
  let chroma;
  let owner;
  let user1;
  let user2;
  let projectWallet;
  let fountainContract;
  
  const BASE_PIXEL_PRICE = ethers.parseEther("0.0001");
  const LOCK_PRICE_MULTIPLIER = 50n;
  const LOCK_DURATION = 3600; // 1 hour
  const USER_COOLDOWN = 60; // 1 minute

  beforeEach(async function () {
    [owner, user1, user2, projectWallet, fountainContract] = await ethers.getSigners();
    
    const ChromaFactory = await ethers.getContractFactory("Chroma");
    chroma = await ChromaFactory.deploy(
      projectWallet.address,
      fountainContract.address
    );
    await chroma.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct project wallet", async function () {
      expect(await chroma.projectWallet()).to.equal(projectWallet.address);
    });

    it("Should set the correct fountain contract", async function () {
      expect(await chroma.fountainContract()).to.equal(fountainContract.address);
    });

    it("Should have correct constants", async function () {
      expect(await chroma.CANVAS_WIDTH()).to.equal(3000);
      expect(await chroma.BASE_PIXEL_PRICE()).to.equal(BASE_PIXEL_PRICE);
      expect(await chroma.LOCK_PRICE_MULTIPLIER()).to.equal(LOCK_PRICE_MULTIPLIER);
      expect(await chroma.LOCK_DURATION()).to.equal(LOCK_DURATION);
      expect(await chroma.USER_COOLDOWN()).to.equal(USER_COOLDOWN);
    });
  });

  describe("Pixel Placement", function () {
    it("Should allow placing a pixel with correct payment", async function () {
      const x = 100;
      const y = 200;
      const color = 0xFF0000; // Red
      const price = await chroma.getPixelPrice(x, y);
      
      const tx = await chroma.connect(user1).placePixel(x, y, color, { value: price });
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === 'PixelChanged');
      
      expect(event.args[0]).to.equal(y * 3000 + x); // coordinate
      expect(event.args[1]).to.equal(user1.address);
      expect(event.args[2]).to.equal(color);
      expect(event.args[3]).to.equal(1); // heat level
      expect(event.args[4]).to.equal(price);
      expect(event.args[5]).to.equal(false); // not locked
    });

    it("Should reject pixel placement with insufficient payment", async function () {
      const x = 100;
      const y = 200;
      const color = 0xFF0000;
      const price = await chroma.getPixelPrice(x, y);
      
      await expect(
        chroma.connect(user1).placePixel(x, y, color, { value: price - 1n })
      ).to.be.revertedWithCustomError(chroma, "InsufficientPayment");
    });

    it("Should enforce user cooldown", async function () {
      const x1 = 100, y1 = 200, x2 = 101, y2 = 201;
      const color = 0xFF0000;
      const price1 = await chroma.getPixelPrice(x1, y1);
      const price2 = await chroma.getPixelPrice(x2, y2);
      
      // Place first pixel
      await chroma.connect(user1).placePixel(x1, y1, color, { value: price1 });
      
      // Try to place second pixel immediately (should fail)
      await expect(
        chroma.connect(user1).placePixel(x2, y2, color, { value: price2 })
      ).to.be.revertedWithCustomError(chroma, "UserOnCooldown");
      
      // Wait for cooldown to expire
      await time.increase(USER_COOLDOWN + 1);
      
      // Should now succeed
      await expect(
        chroma.connect(user1).placePixel(x2, y2, color, { value: price2 })
      ).to.emit(chroma, "PixelChanged");
    });

    it("Should increase heat level for repeated placements", async function () {
      const x = 100;
      const y = 200;
      const color1 = 0xFF0000;
      const color2 = 0x00FF00;
      
      // Place first pixel
      const price1 = await chroma.getPixelPrice(x, y);
      await chroma.connect(user1).placePixel(x, y, color1, { value: price1 });
      
      // Wait for cooldown
      await time.increase(USER_COOLDOWN + 1);
      
      // Place second pixel on same coordinate
      const price2 = await chroma.getPixelPrice(x, y);
      const tx = await chroma.connect(user2).placePixel(x, y, color2, { value: price2 });
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === 'PixelChanged');
      
      expect(event.args[0]).to.equal(y * 3000 + x);
      expect(event.args[1]).to.equal(user2.address);
      expect(event.args[2]).to.equal(color2);
      expect(event.args[3]).to.equal(2); // heat level increased
      expect(event.args[4]).to.equal(price2);
      expect(event.args[5]).to.equal(false);
    });
  });

  describe("Pixel Locking", function () {
    it("Should allow locking a pixel with correct payment", async function () {
      const x = 100;
      const y = 200;
      const color = 0xFF0000;
      const lockPrice = await chroma.getLockPrice(x, y);
      
      const tx = await chroma.connect(user1).lockPixel(x, y, color, { value: lockPrice });
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.fragment?.name === 'PixelLocked');
      
      expect(event.args[0]).to.equal(y * 3000 + x);
      expect(event.args[1]).to.equal(user1.address);
      expect(event.args[2]).to.equal(lockPrice);
    });

    it("Should prevent modification of locked pixels", async function () {
      const x = 100;
      const y = 200;
      const color1 = 0xFF0000;
      const color2 = 0x00FF00;
      
      // Lock the pixel
      const lockPrice = await chroma.getLockPrice(x, y);
      await chroma.connect(user1).lockPixel(x, y, color1, { value: lockPrice });
      
      // Wait for user cooldown
      await time.increase(USER_COOLDOWN + 1);
      
      // Try to place pixel on locked coordinate (should fail)
      const price = await chroma.getPixelPrice(x, y);
      await expect(
        chroma.connect(user2).placePixel(x, y, color2, { value: price })
      ).to.be.revertedWithCustomError(chroma, "PixelIsLocked");
    });

    it("Should allow modification after lock expires", async function () {
      const x = 100;
      const y = 200;
      const color1 = 0xFF0000;
      const color2 = 0x00FF00;
      
      // Lock the pixel
      const lockPrice = await chroma.getLockPrice(x, y);
      await chroma.connect(user1).lockPixel(x, y, color1, { value: lockPrice });
      
      // Wait for lock to expire
      await time.increase(LOCK_DURATION + 1);
      
      // Should now be able to place pixel
      const price = await chroma.getPixelPrice(x, y);
      await expect(
        chroma.connect(user2).placePixel(x, y, color2, { value: price })
      ).to.emit(chroma, "PixelChanged");
    });

    it("Should enforce user cooldown for locking", async function () {
      const x1 = 100, y1 = 200, x2 = 101, y2 = 201;
      const color = 0xFF0000;
      
      // Lock first pixel
      const lockPrice1 = await chroma.getLockPrice(x1, y1);
      await chroma.connect(user1).lockPixel(x1, y1, color, { value: lockPrice1 });
      
      // Try to lock second pixel immediately (should fail)
      const lockPrice2 = await chroma.getLockPrice(x2, y2);
      await expect(
        chroma.connect(user1).lockPixel(x2, y2, color, { value: lockPrice2 })
      ).to.be.revertedWithCustomError(chroma, "UserOnCooldown");
    });
  });

  describe("Fee Distribution", function () {
    it("Should distribute fees correctly (50% to fountain, 50% to project)", async function () {
      const x = 100;
      const y = 200;
      const color = 0xFF0000;
      const price = await chroma.getPixelPrice(x, y);
      
      const projectBalanceBefore = await ethers.provider.getBalance(projectWallet.address);
      const fountainBalanceBefore = await ethers.provider.getBalance(fountainContract.address);
      
      await chroma.connect(user1).placePixel(x, y, color, { value: price });
      
      const projectBalanceAfter = await ethers.provider.getBalance(projectWallet.address);
      const fountainBalanceAfter = await ethers.provider.getBalance(fountainContract.address);
      
      const expectedFee = price / 2n;
      expect(projectBalanceAfter - projectBalanceBefore).to.equal(expectedFee);
      expect(fountainBalanceAfter - fountainBalanceBefore).to.equal(expectedFee);
    });
  });

  describe("View Functions", function () {
    it("Should return correct pixel data", async function () {
      const x = 100;
      const y = 200;
      const color = 0xFF0000;
      const price = await chroma.getPixelPrice(x, y);
      
      await chroma.connect(user1).placePixel(x, y, color, { value: price });
      
      const pixel = await chroma.getPixel(x, y);
      expect(pixel.owner).to.equal(user1.address);
      expect(pixel.color).to.equal(color);
      expect(pixel.heatLevel).to.equal(1);
      expect(pixel.isLocked).to.equal(false);
    });

    it("Should calculate correct pixel price based on heat level", async function () {
      const x = 100;
      const y = 200;
      
      // Initial price should be base price
      let price = await chroma.getPixelPrice(x, y);
      expect(price).to.equal(BASE_PIXEL_PRICE);
      
      // Place pixel to increase heat
      await chroma.connect(user1).placePixel(x, y, 0xFF0000, { value: price });
      
      // Price should increase with heat level
      price = await chroma.getPixelPrice(x, y);
      expect(price).to.be.gt(BASE_PIXEL_PRICE);
    });

    it("Should calculate correct lock price", async function () {
      const x = 100;
      const y = 200;
      
      const basePrice = await chroma.getPixelPrice(x, y);
      const lockPrice = await chroma.getLockPrice(x, y);
      
      expect(lockPrice).to.equal(basePrice * LOCK_PRICE_MULTIPLIER);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle boundary coordinates", async function () {
      const price = await chroma.getPixelPrice(0, 0);
      await expect(
        chroma.connect(user1).placePixel(0, 0, 0xFF0000, { value: price })
      ).to.emit(chroma, "PixelChanged");
      
      // Wait for cooldown
      await time.increase(USER_COOLDOWN + 1);
      
      const price2 = await chroma.getPixelPrice(2999, 2999);
      await expect(
        chroma.connect(user1).placePixel(2999, 2999, 0x00FF00, { value: price2 })
      ).to.emit(chroma, "PixelChanged");
    });

    it("Should reject out-of-bounds coordinates", async function () {
      const price = BASE_PIXEL_PRICE;
      
      await expect(
        chroma.connect(user1).placePixel(3000, 500, 0xFF0000, { value: price })
      ).to.be.revertedWithCustomError(chroma, "InvalidCoordinates");
      
      await expect(
        chroma.connect(user1).placePixel(500, 3000, 0xFF0000, { value: price })
      ).to.be.revertedWithCustomError(chroma, "InvalidCoordinates");
    });

    it("Should handle maximum heat level", async function () {
      const x = 100;
      const y = 200;
      
      // Place pixels repeatedly to reach max heat
      for (let i = 0; i < 10; i++) {
        const price = await chroma.getPixelPrice(x, y);
        await chroma.connect(user1).placePixel(x, y, 0xFF0000 + i, { value: price });
        await time.increase(USER_COOLDOWN + 1);
      }
      
      const pixel = await chroma.getPixel(x, y);
      expect(pixel.heatLevel).to.be.lte(255); // Should not exceed uint8 max
    });
  });
});