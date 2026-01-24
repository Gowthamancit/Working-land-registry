# 🚀 Quick Start Guide - LandRegistry Smart Contract

## Overview
This guide will help you quickly deploy and test the LandRegistry smart contract.

## 📋 Prerequisites
- Node.js v16+ installed
- MetaMask or another Ethereum wallet
- Some testnet ETH (Sepolia recommended)

## 🔧 Installation

```bash
# Install dependencies
npm install
```

## 🏗️ Compile Contract

```bash
npx hardhat compile
```

Expected output: `Compiled 23 Solidity files successfully`

## 🧪 Run Tests

```bash
# Run all tests
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

Expected: All 21 tests should pass ✅

## 🌐 Deploy to Local Network

### Step 1: Start local blockchain
```bash
npx hardhat node
```

Keep this running in one terminal.

### Step 2: Deploy (in a new terminal)
```bash
npx hardhat run scripts/deploy.js --network localhost
```

## 🚢 Deploy to Sepolia Testnet

### Step 1: Setup Environment
```bash
# Copy environment template
copy .env.example .env

# Edit .env and add:
# - Your PRIVATE_KEY
# - Your SEPOLIA_RPC_URL (get from Alchemy/Infura)
# - Your GOVERNMENT_ADDRESS (the address that will sign approvals)
# - Your ETHERSCAN_API_KEY (for verification)
```

### Step 2: Deploy
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

The contract will be:
1. Deployed to Sepolia
2. Automatically verified on Etherscan
3. Saved to `deployments/sepolia.json`

## 🎮 Interact with Contract

### Option 1: Interactive CLI
```bash
npx hardhat run scripts/interact.js --network localhost
# or
npx hardhat run scripts/interact.js --network sepolia
```

This provides a menu-driven interface to:
- View contract info
- Whitelist surveyors
- Generate government signatures
- Mint land NFTs
- List/buy land
- View your lands

### Option 2: Hardhat Console
```bash
npx hardhat console --network localhost
```

Then:
```javascript
const LandRegistry = await ethers.getContractFactory("LandRegistry");
const address = "YOUR_DEPLOYED_ADDRESS";
const contract = LandRegistry.attach(address);

// View government address
await contract.governmentAddress();

// Get total supply
await contract.totalSupply();
```

## 📝 Example Workflow

### 1. Whitelist a Surveyor (Owner only)
```javascript
await contract.whitelistSurveyor("0xSurveyorAddress");
```

### 2. Government Creates Signature (Off-chain)
```javascript
const ethers = require('ethers');

const ownerAddress = "0xOwnerAddress";
const h3Hash = "8928308280fffff";
const arweaveHash = "arweave://abc123";

// Create message hash
const messageHash = ethers.solidityPackedKeccak256(
  ["address", "string", "string"],
  [ownerAddress, h3Hash, arweaveHash]
);

// Government signs
const signature = await governmentWallet.signMessage(
  ethers.getBytes(messageHash)
);

console.log("Signature:", signature);
```

### 3. User Mints Land
```javascript
const tx = await contract.mint(
  "8928308280fffff",
  "arweave://abc123",
  "0x..." // signature from step 2
);
await tx.wait();
```

### 4. List Land for Sale
```javascript
const tokenId = 1;
const price = ethers.parseEther("10"); // 10 ETH

await contract.listLand(tokenId, price);
```

### 5. Buy Land
```javascript
const listing = await contract.getListing(tokenId);
await contract.buyLand(tokenId, { value: listing.price });
```

## 🔍 Verify Contract Manually

If auto-verification fails:

```bash
npx hardhat verify --network sepolia DEPLOYED_ADDRESS "GOVERNMENT_ADDRESS"
```

## 📊 Key Contract Functions

### Admin Functions
- `setGovernmentAddress(address)` - Update government address
- `whitelistSurveyor(address)` - Add surveyor
- `removeSurveyor(address)` - Remove surveyor
- `batchWhitelistSurveyors(address[])` - Bulk add surveyors

### Core Functions
- `mint(h3Hash, arweaveHash, signature)` - Mint land with gov approval
- `listLand(tokenId, price)` - List for sale
- `buyLand(tokenId)` - Purchase listed land
- `unlistLand(tokenId)` - Remove listing

### View Functions
- `getListing(tokenId)` - Get listing details
- `getActiveListings()` - All active listings
- `getLandsByOwner(address)` - Lands owned by address
- `getH3Hash(tokenId)` - H3 hash for token
- `totalSupply()` - Total minted lands

## 🎯 Architecture Summary

```
┌─────────────────────────────────────┐
│         Government (Judge)          │
│    Signs approval off-chain         │
└──────────────┬──────────────────────┘
               │ signature
               ▼
┌─────────────────────────────────────┐
│      LandRegistry Contract          │
│  - Verifies signature (ECDSA)       │
│  - Mints NFT if valid               │
│  - Marketplace built-in             │
└─────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      ERC721 NFT Ownership           │
│  - H3 geohash as ID                 │
│  - Arweave for metadata             │
└─────────────────────────────────────┘
```

## 🔒 Security Notes

1. **NEVER commit `.env` file** - Contains private keys
2. **Government key must be ultra-secure** - It approves all mints
3. **Test extensively on testnet** before mainnet
4. **Audit recommended** for mainnet deployment
5. **Use hardware wallet** for government signatures

## 🐛 Troubleshooting

### "Invalid signature" error
- Ensure message hash is constructed correctly
- Verify government address matches signer
- Check signature format

### "Land already minted" error
- H3 hash must be unique
- Check if land already exists

### Tests failing
- Ensure dependencies are installed: `npm install`
- Clear cache: `npx hardhat clean`
- Recompile: `npx hardhat compile`

### Deployment fails
- Check you have enough ETH in wallet
- Verify RPC URL is correct
- Ensure PRIVATE_KEY is set in .env

## 📚 Additional Resources

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [H3 Documentation](https://h3geo.org/)
- [Arweave Documentation](https://www.arweave.org/)
- [Ethers.js Documentation](https://docs.ethers.org/)

## 🆘 Need Help?

1. Check the README.md for detailed documentation
2. Review test files for usage examples
3. Examine deployment logs in `deployments/` folder
4. Verify contract is compiled: `npx hardhat compile`

---

**Happy Building! 🏗️**
