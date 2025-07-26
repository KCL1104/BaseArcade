import { ethers } from 'ethers';

// Chroma Contract ABI
export const CHROMA_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_projectWallet",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "InsufficientPayment",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidColor",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidCoordinates",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PixelAlreadyLocked",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TransferFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UserOnCooldown",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "coordinate",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "oldHeatLevel",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "newHeatLevel",
        "type": "uint8"
      }
    ],
    "name": "HeatDecayed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "coordinate",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "placer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint24",
        "name": "color",
        "type": "uint24"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "heatLevel",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "pricePaid",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "timestamp",
        "type": "uint64"
      }
    ],
    "name": "PixelChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "coordinate",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "locker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint24",
        "name": "color",
        "type": "uint24"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "lockPrice",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "lockedUntil",
        "type": "uint64"
      }
    ],
    "name": "PixelLocked",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "BASE_PIXEL_PRICE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "CANVAS_HEIGHT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "CANVAS_WIDTH",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint16",
        "name": "startX",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "startY",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "width",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "height",
        "type": "uint16"
      }
    ],
    "name": "getCanvasRegion",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "uint24",
            "name": "color",
            "type": "uint24"
          },
          {
            "internalType": "uint8",
            "name": "heatLevel",
            "type": "uint8"
          },
          {
            "internalType": "uint64",
            "name": "lastPlacedTime",
            "type": "uint64"
          }
        ],
        "internalType": "struct Chroma.Pixel[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCanvasStats",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "totalPlaced",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "canvasSize",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint16",
        "name": "x",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "y",
        "type": "uint16"
      }
    ],
    "name": "getPixel",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "uint24",
            "name": "color",
            "type": "uint24"
          },
          {
            "internalType": "uint8",
            "name": "heatLevel",
            "type": "uint8"
          },
          {
            "internalType": "uint64",
            "name": "lastPlacedTime",
            "type": "uint64"
          }
        ],
        "internalType": "struct Chroma.Pixel",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint16",
        "name": "x",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "y",
        "type": "uint16"
      }
    ],
    "name": "getPixelPrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint16",
        "name": "x",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "y",
        "type": "uint16"
      }
    ],
    "name": "getLockPrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getUserCooldownTime",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getUserStats",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "pixelCount",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "isUserOnCooldown",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint16",
        "name": "x",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "y",
        "type": "uint16"
      },
      {
        "internalType": "uint24",
        "name": "color",
        "type": "uint24"
      }
    ],
    "name": "lockPixel",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint16",
        "name": "x",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "y",
        "type": "uint16"
      },
      {
        "internalType": "uint24",
        "name": "color",
        "type": "uint24"
      }
    ],
    "name": "placePixel",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalPixelsPlaced",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Contract address from environment
export const CHROMA_CONTRACT_ADDRESS = import.meta.env.VITE_CHROMA_CONTRACT_ADDRESS;

// Type definitions
export interface Pixel {
  owner: string;
  timestamp: bigint;
  color: number;
  heatLevel: number;
  lastPlacedTime: bigint;
}

export interface CanvasStats {
  totalPlaced: bigint;
  canvasSize: bigint;
}

// Contract helper functions
export const getChromaContract = (provider: ethers.Provider | ethers.Signer) => {
  return new ethers.Contract(CHROMA_CONTRACT_ADDRESS, CHROMA_ABI, provider);
};

export const formatPixelColor = (color: number): string => {
  return `#${color.toString(16).padStart(6, '0')}`;
};

export const parsePixelColor = (hexColor: string): number => {
  return parseInt(hexColor.replace('#', ''), 16);
};

export const formatPrice = (price: bigint): string => {
  return ethers.formatEther(price);
};