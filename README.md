# LandRegistry Smart Contract

A decentralized land registry system on the blockchain with government signature verification, NFT-based ownership, and built-in marketplace.

## 🎯 Overview

This smart contract implements a **"Judge" system** where the government acts as a trusted authority to verify and approve land ownership before minting NFTs. Each land parcel is uniquely identified by its H3 geohash and stored on Arweave.

## ✨ Key Features

### 1. **Government Signature Verification (The "Judge")**
- Government signs land ownership approvals off-chain
- Contract verifies signatures using ECDSA before minting
- Prevents unauthorized land registration
- Implements `keccak256(abi.encodePacked(owner, h3Hash, arweaveHash))` for message reconstruction

### 2. **ERC721 NFT Ownership**
- Each land parcel is an NFT (ERC721URIStorage)
- Unique token IDs tied to H3 geohashes
- Metadata stored on Arweave (decentralized storage)
- Full ownership transfer capabilities

### 3. **Surveyor Whitelist**
- Admin can whitelist/remove surveyors
- Batch whitelisting support
- Role-based access control

### 4. **Built-in Marketplace**
- **listLand**: List land parcels for sale
- **buyLand**: Automatic NFT transfer on payment
- **unlistLand**: Remove listings
- **updateListingPrice**: Change listing price
- Secure payment handling with reentrancy protection

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   LandRegistry                      │
├─────────────────────────────────────────────────────┤
│  Inheritance:                                       │
│  ├─ ERC721URIStorage (OpenZeppelin)                │
│  ├─ Ownable (OpenZeppelin)                         │
│  └─ ReentrancyGuard (OpenZeppelin)                 │
├─────────────────────────────────────────────────────┤
│  Core Functions:                                    │
│  ├─ mint() - Verify gov signature & mint NFT       │
│  ├─ listLand() - List land for sale                │
│  ├─ buyLand() - Purchase listed land               │
│  └─ unlistLand() - Remove listing                  │
├─────────────────────────────────────────────────────┤
│  Roles:                                             │
│  ├─ Owner (deployer) - Manage surveyors            │
│  ├─ Government - Sign minting approvals            │
│  └─ Surveyors - Whitelisted for data submission    │
└─────────────────────────────────────────────────────┘
```

## 📋 Contract Functions

### Admin Functions

```solidity
// Set government address (only owner)
function setGovernmentAddress(address _newGovernmentAddress) external onlyOwner

// Whitelist a surveyor
function whitelistSurveyor(address _surveyor) external onlyOwner

// Remove a surveyor
function removeSurveyor(address _surveyor) external onlyOwner

// Batch whitelist surveyors
function batchWhitelistSurveyors(address[] calldata _surveyors) external onlyOwner
```

### Minting Function (The "Judge")

```solidity
/**
 * @notice Mints a new land NFT with government signature verification
 * @param h3Hash The H3 geohash of the land parcel
 * @param arweaveHash The Arweave hash containing land documents
 * @param govSign The government's signature approving this mint
 * @return tokenId The minted token ID
 */
function mint(
    string memory h3Hash,
    string memory arweaveHash,
    bytes memory govSign
) external returns (uint256)
```

**How it works:**
1. User provides: `h3Hash`, `arweaveHash`, and `govSign`
2. Contract reconstructs: `messageHash = keccak256(abi.encodePacked(msg.sender, h3Hash, arweaveHash))`
3. Recovers signer from signature using ECDSA
4. Verifies signer is the government address
5. Mints NFT if valid

### Marketplace Functions

```solidity
// List land for sale
function listLand(uint256 tokenId, uint256 price) external

// Buy listed land (automatic transfer)
function buyLand(uint256 tokenId) external payable

// Remove listing
function unlistLand(uint256 tokenId) external

// Update listing price
function updateListingPrice(uint256 tokenId, uint256 newPrice) external
```

### View Functions

```solidity
// Get listing details
function getListing(uint256 tokenId) external view returns (Listing memory)

// Get all active listings
function getActiveListings() external view returns (uint256[] memory)

// Get H3 hash for token
function getH3Hash(uint256 tokenId) external view returns (string memory)

// Get token ID by H3 hash
function getTokenIdByH3(string memory h3Hash) external view returns (uint256)

// Get all lands owned by address
function getLandsByOwner(address owner) external view returns (uint256[] memory)

// Get total supply
function totalSupply() external view returns (uint256)
```

## 🚀 Deployment

### Prerequisites

```bash
npm install
```

### Setup Environment

1. Copy `.env.example` to `.env`
2. Fill in your values:
   - `PRIVATE_KEY`: Your wallet private key
   - `GOVERNMENT_ADDRESS`: The government signer address
   - `SEPOLIA_RPC_URL`: Your RPC endpoint
   - `ETHERSCAN_API_KEY`: For contract verification

### Deploy to Local Network

```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

### Deploy to Sepolia Testnet

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### Deploy to Mainnet

```bash
npx hardhat run scripts/deploy.js --network mainnet
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
npx hardhat test
```

Run with gas reporting:

```bash
REPORT_GAS=true npx hardhat test
```

Run with coverage:

```bash
npx hardhat coverage
```

## 📝 Usage Example

### 1. Government Signs Approval (Off-chain)

```javascript
const ethers = require('ethers');

// Government creates signature
const ownerAddress = "0x...";
const h3Hash = "8928308280fffff";
const arweaveHash = "arweave://abc123";

const messageHash = ethers.solidityPackedKeccak256(
  ["address", "string", "string"],
  [ownerAddress, h3Hash, arweaveHash]
);

const signature = await governmentWallet.signMessage(
  ethers.getBytes(messageHash)
);
```

### 2. User Mints Land NFT (On-chain)

```javascript
const tx = await landRegistry.mint(h3Hash, arweaveHash, signature);
await tx.wait();
console.log("Land minted!");
```

### 3. List Land for Sale

```javascript
const price = ethers.parseEther("10"); // 10 ETH
await landRegistry.listLand(tokenId, price);
```

### 4. Buy Land

```javascript
const listing = await landRegistry.getListing(tokenId);
await landRegistry.buyLand(tokenId, { value: listing.price });
```

## 🔒 Security Features

1. **ECDSA Signature Verification**: Prevents unauthorized minting
2. **ReentrancyGuard**: Protects marketplace functions
3. **Custom Errors**: Gas-efficient error handling
4. **Access Control**: Owner-only admin functions
5. **Payment Security**: Automatic refunds for overpayment
6. **Transfer Protection**: Auto-unlists when NFT is transferred

## 🛠️ Technology Stack

- **Solidity**: 0.8.20
- **OpenZeppelin Contracts**: v5.0.1
- **Hardhat**: Development environment
- **Ethers.js**: Ethereum library
- **Chai**: Testing framework

## 📂 Project Structure

```
land-registry/
├── contracts/
│   └── LandRegistry.sol          # Main contract
├── frontend/                     # React + Vite Frontend
│   ├── src/
│   │   ├── utils/crypto.ts       # Hashing & H3 utils
│   │   └── firebase.ts           # Firebase config
├── scripts/
│   └── deploy.js            # Deployment script
├── test/
│   └── LandRegistry.test.js # Test suite
├── hardhat.config.js        # Hardhat configuration
├── package.json             # Dependencies
├── .env.example             # Environment template
└── README.md                # This file
```

## 🔥 Database Setup (Firebase)

To facilitate the workflow between Surveyors, Government, and Owners, we use Firebase Firestore.

### 1. Create a Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com/).
- Create a new project named `Land Registry`.

### 2. Firestore Collections
Create the following three collections in "Production Mode" or "Test Mode":

1.  **`applications`**:
    *   **Purpose**: Stores land registration requests from surveyors.
    *   **Fields**:
        *   `ownerAddress`: **string** (The Ethereum address of the land owner)
        *   `h3Hash`: **string** (The H3 geospatial index of the land)
        *   `arweaveHash`: **string** (The Arweave CID containing land documents)
        *   `surveyorAddress`: **string** (The Ethereum address of the surveyor who submitted)
        *   `surveyorSignature`: **string** (The cryptographic signature from the surveyor)
        *   `coordinates`: **array** (List of `{lat: string, lng: string}` objects)
        *   `status`: **string** (`pending` | `approved` | `rejected` | `minted`)
        *   `timestamp`: **timestamp** (Firestore server timestamp)
        *   `govSignature`: **string** (Added by government upon approval - optional)
        *   `approvedAt`: **string** (ISO 8601 date string - optional)
        *   `approverAddress`: **string** (Address of the govt official who approved - optional)

2.  **`surveyors`**:
    *   **Purpose**: Records whitelisted surveyors and their profiles.
    *   **Fields**:
        *   `address`: **string** (The Ethereum address of the surveyor)
        *   `name`: **string** (Full name of the surveyor)
        *   `licenseNumber`: **string** (Official surveyor license ID)
        *   `isWhitelisted`: **boolean** (Whether the surveyor is active/authorized)

3.  **`government`**:
    *   **Purpose**: Stores configuration and logs of government actions.
    *   **Fields**:
        *   `adminAddress`: **string** (The Ethereum address of the administrator)
        *   `lastAction`: **string** (Description of the last administrative action)
        *   `settings`: **map** (Configuration key-value pairs)
        *   `role`: **string** (Set to `admin` for authorization in rules)

### 3. Firestore Security Rules
Copy and paste these rules into the "Rules" tab of your Firestore database to ensure basic security:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow whitelisted surveyors to create applications
    match /applications/{docId} {
      allow read: if true;
      allow create: if request.auth != null; 
      allow update: if request.auth != null && (get(/databases/$(database)/documents/government/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Public read for surveyors, write only by admin
    match /surveyors/{docId} {
      allow read: if true;
      allow write: if false; // Managed via Admin/Owner
    }
    
    // Government specific data
    match /government/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Local Environment
Create a `.env` file inside the `frontend` directory with your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 🎨 Contract Events

```solidity
event GovernmentAddressUpdated(address indexed oldAddress, address indexed newAddress);
event SurveyorWhitelisted(address indexed surveyor);
event SurveyorRemoved(address indexed surveyor);
event LandMinted(uint256 indexed tokenId, address indexed owner, string h3Hash, string arweaveHash);
event LandListed(uint256 indexed tokenId, address indexed seller, uint256 price);
event LandUnlisted(uint256 indexed tokenId);
event LandSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
```

## ⚠️ Important Notes

1. **Government Key Security**: The government private key must be kept extremely secure
2. **H3 Resolution**: Ensure consistent H3 resolution across your system (recommended: 9)
3. **Arweave Storage**: Upload land documents to Arweave before minting
4. **Gas Optimization**: Contract is optimized with Solidity 0.8.20 optimizer
5. **Testnet First**: Always deploy to testnet before mainnet

## 📊 Gas Estimates

| Function | Estimated Gas |
|----------|--------------|
| mint() | ~150,000 |
| listLand() | ~80,000 |
| buyLand() | ~120,000 |
| unlistLand() | ~50,000 |

## 🤝 Contributing

Contributions are welcome! Please ensure:
- All tests pass
- Code follows Solidity style guide
- Functions are well-documented
- Security best practices are followed

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [H3 Geospatial Indexing](https://h3geo.org/)
- [Arweave](https://www.arweave.org/)

## 📞 Support

For questions or issues, please open a GitHub issue or contact the development team.

---

**Built with ❤️ for decentralized land ownership**
