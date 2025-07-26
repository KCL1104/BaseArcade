// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Chroma
 * @dev Collaborative onchain pixel canvas with dynamic pricing
 * @author Base Arcade Team
 */
contract Chroma {
    struct Pixel {
        address owner;
        uint64 timestamp;
        uint24 color;
        uint8 heatLevel;
        uint64 lastPlacedTime;
        uint64 lockedUntil;  // Timestamp when pixel lock expires
        bool isLocked;       // Whether pixel is currently locked
    }
    
    // Canvas configuration
    uint256 public constant CANVAS_WIDTH = 3000;
    uint256 public constant CANVAS_HEIGHT = 3000;
    uint256 public constant TOTAL_PIXELS = CANVAS_WIDTH * CANVAS_HEIGHT;
    
    // Pricing configuration
    uint256 public constant BASE_PIXEL_PRICE = 0.0001 ether;
    uint256 public constant HEAT_MULTIPLIER = 150; // 1.5x multiplier per heat level (150/100)
    uint256 public constant MAX_HEAT_LEVEL = 10;
    uint256 public constant HEAT_DECAY_TIME = 1 hours;
    uint256 public constant LOCK_PRICE_MULTIPLIER = 50;  // 50x price for locking
    uint256 public constant LOCK_DURATION = 1 hours;     // Lock duration
    uint256 public constant USER_COOLDOWN = 1 minutes;   // User cooldown between placements
    
    // Project wallet for revenue
    address public immutable projectWallet;
    address public immutable fountainContract;  // The Fountain contract address
    
    // Pixel storage
    mapping(uint256 => Pixel) public pixels;
    
    // Statistics
    uint256 public totalPixelsPlaced;
    mapping(address => uint256) public userPixelCount;
    mapping(address => uint64) public userLastPlacement;  // User cooldown tracking
    
    // Events
    event PixelChanged(
        uint256 indexed coordinate,
        address indexed placer,
        uint24 color,
        uint8 heatLevel,
        uint256 pricePaid,
        bool isLocked,
        uint64 timestamp
    );
    
    event PixelLocked(
        uint256 indexed coordinate,
        address indexed locker,
        uint256 lockPrice,
        uint64 lockedUntil
    );
    
    event HeatDecayed(
        uint256 indexed coordinate,
        uint8 oldHeatLevel,
        uint8 newHeatLevel
    );
    
    // Custom errors
    error InvalidCoordinates();
    error InsufficientPayment();
    error TransferFailed();
    error InvalidColor();
    error PixelIsLocked();
    error UserOnCooldown();
    error InvalidFountainContract();
    
    constructor(address _projectWallet, address _fountainContract) {
        require(_projectWallet != address(0), "Invalid project wallet");
        require(_fountainContract != address(0), "Invalid fountain contract");
        projectWallet = _projectWallet;
        fountainContract = _fountainContract;
    }
    
    /**
     * @dev Place a pixel on the canvas
     * @param x X coordinate (0 to CANVAS_WIDTH-1)
     * @param y Y coordinate (0 to CANVAS_HEIGHT-1)
     * @param color 24-bit RGB color value
     */
    function placePixel(uint16 x, uint16 y, uint24 color) external payable {
        if (x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) {
            revert InvalidCoordinates();
        }
        
        if (color > 0xFFFFFF) {
            revert InvalidColor();
        }
        
        // Check user cooldown
        if (userLastPlacement[msg.sender] + USER_COOLDOWN > block.timestamp) {
            revert UserOnCooldown();
        }
        
        uint256 coordinate = _getCoordinate(x, y);
        Pixel storage pixel = pixels[coordinate];
        
        // Check if pixel is locked
        if (pixel.isLocked && pixel.lockedUntil > block.timestamp) {
            revert PixelIsLocked();
        }
        
        uint256 requiredPrice = getPixelPrice(x, y);
        
        if (msg.value < requiredPrice) {
            revert InsufficientPayment();
        }
        
        // Calculate new heat level
        uint8 currentHeat = _calculateCurrentHeat(pixel);
        uint8 newHeat = currentHeat < MAX_HEAT_LEVEL ? currentHeat + 1 : uint8(MAX_HEAT_LEVEL);
        
        // Update pixel (clear lock if expired)
        pixel.owner = msg.sender;
        pixel.timestamp = uint64(block.timestamp);
        pixel.color = color;
        pixel.heatLevel = newHeat;
        pixel.lastPlacedTime = uint64(block.timestamp);
        pixel.isLocked = false;
        pixel.lockedUntil = 0;
        
        // Update user cooldown
        userLastPlacement[msg.sender] = uint64(block.timestamp);
        
        // Update statistics
        if (currentHeat == 0) {
            totalPixelsPlaced++;
        }
        userPixelCount[msg.sender]++;
        
        // Split payment: 50% to project wallet, 50% to fountain
        uint256 projectShare = msg.value / 2;
        uint256 fountainShare = msg.value - projectShare;
        
        // Transfer project share
        (bool success1, ) = projectWallet.call{value: projectShare}("");
        if (!success1) {
            revert TransferFailed();
        }
        
        // Transfer fountain share
        (bool success2, ) = fountainContract.call{value: fountainShare}("");
        if (!success2) {
            revert TransferFailed();
        }
        
        emit PixelChanged(
            coordinate,
            msg.sender,
            color,
            newHeat,
            msg.value,
            false,
            uint64(block.timestamp)
        );
    }

    /**
     * @dev Lock a pixel for 1 hour at 50x the normal price
     * @param x X coordinate (0 to CANVAS_WIDTH-1)
     * @param y Y coordinate (0 to CANVAS_HEIGHT-1)
     * @param color 24-bit RGB color value
     */
    function lockPixel(uint16 x, uint16 y, uint24 color) external payable {
        if (x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) {
            revert InvalidCoordinates();
        }
        
        if (color > 0xFFFFFF) {
            revert InvalidColor();
        }
        
        // Check user cooldown
        if (userLastPlacement[msg.sender] + USER_COOLDOWN > block.timestamp) {
            revert UserOnCooldown();
        }
        
        uint256 coordinate = _getCoordinate(x, y);
        Pixel storage pixel = pixels[coordinate];
        
        // Check if pixel is already locked
        if (pixel.isLocked && pixel.lockedUntil > block.timestamp) {
            revert PixelIsLocked();
        }
        
        uint256 lockPrice = getLockPrice(x, y);
        
        if (msg.value < lockPrice) {
            revert InsufficientPayment();
        }
        
        // Calculate new heat level
        uint8 currentHeat = _calculateCurrentHeat(pixel);
        uint8 newHeat = currentHeat < MAX_HEAT_LEVEL ? currentHeat + 1 : uint8(MAX_HEAT_LEVEL);
        
        // Update pixel with lock
        pixel.owner = msg.sender;
        pixel.timestamp = uint64(block.timestamp);
        pixel.color = color;
        pixel.heatLevel = newHeat;
        pixel.lastPlacedTime = uint64(block.timestamp);
        pixel.isLocked = true;
        pixel.lockedUntil = uint64(block.timestamp + LOCK_DURATION);
        
        // Update user cooldown
        userLastPlacement[msg.sender] = uint64(block.timestamp);
        
        // Update statistics
        if (currentHeat == 0) {
            totalPixelsPlaced++;
        }
        userPixelCount[msg.sender]++;
        
        // Split payment: 50% to project wallet, 50% to fountain
        uint256 projectShare = msg.value / 2;
        uint256 fountainShare = msg.value - projectShare;
        
        // Transfer project share
        (bool success1, ) = projectWallet.call{value: projectShare}("");
        if (!success1) {
            revert TransferFailed();
        }
        
        // Transfer fountain share
        (bool success2, ) = fountainContract.call{value: fountainShare}("");
        if (!success2) {
            revert TransferFailed();
        }
        
        emit PixelChanged(
            coordinate,
            msg.sender,
            color,
            newHeat,
            msg.value,
            true,
            uint64(block.timestamp)
        );
        
        emit PixelLocked(
            coordinate,
            msg.sender,
            msg.value,
            pixel.lockedUntil
        );
    }

    /**
     * @dev Get pixel data at coordinates
     * @param x X coordinate
     * @param y Y coordinate
     * @return Pixel data with current heat level
     */
    function getPixel(uint16 x, uint16 y) external view returns (Pixel memory) {
        if (x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) {
            revert InvalidCoordinates();
        }
        
        uint256 coordinate = _getCoordinate(x, y);
        Pixel memory pixel = pixels[coordinate];
        
        // Calculate current heat level with decay
        pixel.heatLevel = _calculateCurrentHeat(pixel);
        
        // Update lock status if expired
        if (pixel.isLocked && pixel.lockedUntil <= block.timestamp) {
            pixel.isLocked = false;
            pixel.lockedUntil = 0;
        }
        
        return pixel;
    }
    
    /**
     * @dev Get current price for a pixel
     * @param x X coordinate
     * @param y Y coordinate
     * @return Current price in wei
     */
    function getPixelPrice(uint16 x, uint16 y) public view returns (uint256) {
        if (x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) {
            revert InvalidCoordinates();
        }
        
        uint256 coordinate = _getCoordinate(x, y);
        Pixel storage pixel = pixels[coordinate];
        
        uint8 currentHeat = _calculateCurrentHeat(pixel);
        
        // Base price * (heat multiplier ^ heat level)
        uint256 price = BASE_PIXEL_PRICE;
        for (uint8 i = 0; i < currentHeat; i++) {
            price = (price * HEAT_MULTIPLIER) / 100;
        }
        
        return price;
    }
    
    /**
     * @dev Get lock price for a pixel (50x normal price)
     * @param x X coordinate
     * @param y Y coordinate
     * @return Lock price in wei
     */
    function getLockPrice(uint16 x, uint16 y) public view returns (uint256) {
        if (x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) {
            revert InvalidCoordinates();
        }
        
        uint256 coordinate = _getCoordinate(x, y);
        Pixel storage pixel = pixels[coordinate];
        
        uint8 currentHeat = _calculateCurrentHeat(pixel);
        
        // Lock price is 50x the normal price
        uint256 basePrice = getPixelPrice(x, y);
        return basePrice * LOCK_PRICE_MULTIPLIER;
    }
    
    /**
     * @dev Check if user is on cooldown
     * @param user User address
     * @return True if user is on cooldown
     */
    function isUserOnCooldown(address user) external view returns (bool) {
        return userLastPlacement[user] + USER_COOLDOWN > block.timestamp;
    }
    
    /**
     * @dev Get remaining cooldown time for user
     * @param user User address
     * @return Remaining cooldown time in seconds
     */
    function getUserCooldownTime(address user) external view returns (uint256) {
        uint256 cooldownEnd = userLastPlacement[user] + USER_COOLDOWN;
        if (cooldownEnd <= block.timestamp) {
            return 0;
        }
        return cooldownEnd - block.timestamp;
    }
    
    /**
     * @dev Get canvas region data
     * @param startX Starting X coordinate
     * @param startY Starting Y coordinate
     * @param width Width of region
     * @param height Height of region
     * @return Array of pixel data
     */
    function getCanvasRegion(
        uint16 startX,
        uint16 startY,
        uint16 width,
        uint16 height
    ) external view returns (Pixel[] memory) {
        if (startX + width > CANVAS_WIDTH || startY + height > CANVAS_HEIGHT) {
            revert InvalidCoordinates();
        }
        
        uint256 regionSize = uint256(width) * uint256(height);
        Pixel[] memory region = new Pixel[](regionSize);
        
        uint256 index = 0;
        for (uint16 y = startY; y < startY + height; y++) {
            for (uint16 x = startX; x < startX + width; x++) {
                uint256 coordinate = _getCoordinate(x, y);
                Pixel memory pixel = pixels[coordinate];
                pixel.heatLevel = _calculateCurrentHeat(pixel);
                region[index] = pixel;
                index++;
            }
        }
        
        return region;
    }
    
    /**
     * @dev Get user statistics
     * @param user User address
     * @return pixelCount Number of pixels placed by user
     */
    function getUserStats(address user) external view returns (uint256 pixelCount) {
        return userPixelCount[user];
    }
    
    /**
     * @dev Get global canvas statistics
     * @return totalPlaced Total pixels placed
     * @return canvasSize Total canvas size
     */
    function getCanvasStats() external view returns (uint256 totalPlaced, uint256 canvasSize) {
        return (totalPixelsPlaced, TOTAL_PIXELS);
    }
    
    /**
     * @dev Convert x,y coordinates to single coordinate
     * @param x X coordinate
     * @param y Y coordinate
     * @return Single coordinate value
     */
    function _getCoordinate(uint16 x, uint16 y) internal pure returns (uint256) {
        return uint256(y) * CANVAS_WIDTH + uint256(x);
    }
    
    /**
     * @dev Calculate current heat level with time-based decay
     * @param pixel Pixel data
     * @return Current heat level
     */
    function _calculateCurrentHeat(Pixel memory pixel) internal view returns (uint8) {
        if (pixel.lastPlacedTime == 0) {
            return 0;
        }
        
        uint256 timePassed = block.timestamp - pixel.lastPlacedTime;
        uint256 decayPeriods = timePassed / HEAT_DECAY_TIME;
        
        if (decayPeriods >= pixel.heatLevel) {
            return 0;
        }
        
        return pixel.heatLevel - uint8(decayPeriods);
    }
    
    /**
     * @dev Manually trigger heat decay for a pixel (gas optimization)
     * @param x X coordinate
     * @param y Y coordinate
     */
    function decayPixelHeat(uint16 x, uint16 y) external {
        if (x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) {
            revert InvalidCoordinates();
        }
        
        uint256 coordinate = _getCoordinate(x, y);
        Pixel storage pixel = pixels[coordinate];
        
        uint8 oldHeat = pixel.heatLevel;
        uint8 newHeat = _calculateCurrentHeat(pixel);
        
        if (newHeat != oldHeat) {
            pixel.heatLevel = newHeat;
            emit HeatDecayed(coordinate, oldHeat, newHeat);
        }
    }
}