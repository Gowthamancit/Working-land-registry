// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LandRegistry
 * @dev Re-deployed with verbose error reporting to debug signature issues.
 */
contract LandRegistry is ERC721URIStorage, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    address public governmentAddress;
    mapping(address => bool) public whitelistedSurveyors;
    uint256[] private _allMintedTokens;
    
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool isActive;
    }
    
    mapping(uint256 => Listing) public listings;
    uint256[] public activeListings;
    
    // Verbose Errors for Debugging
    error InvalidGovernmentAddress();
    error SignatureMismatch(address recovered, address expectedGov);
    error LandAlreadyMinted(uint256 tokenId);
    error NotAuthorized();
    error InvalidPrice();
    error LandNotListed();
    error InsufficientPayment();
    error LandAlreadyListed();
    error NotLandOwner();
    error TransferFailed();
    
    event LandMinted(uint256 indexed tokenId, address indexed owner, bytes32 h3Hash, string arweaveHash);
    event LandListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event LandUnlisted(uint256 indexed tokenId);
    event LandSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    
    constructor(address _governmentAddress) 
        ERC721("LandRegistry", "LAND") 
        Ownable(msg.sender) 
    {
        if (_governmentAddress == address(0)) revert InvalidGovernmentAddress();
        governmentAddress = _governmentAddress;
    }
    
    function setGovernmentAddress(address _newGovernmentAddress) external onlyOwner {
        if (_newGovernmentAddress == address(0)) revert InvalidGovernmentAddress();
        governmentAddress = _newGovernmentAddress;
    }
    
    function whitelistSurveyor(address _surveyor) external onlyOwner {
        whitelistedSurveyors[_surveyor] = true;
    }
    
    function removeSurveyor(address _surveyor) external onlyOwner {
        whitelistedSurveyors[_surveyor] = false;
    }
    
    /**
     * @notice Mints a new land NFT using the h3Hash as the Token ID
     */
    function mint(
        bytes32 h3Hash,
        string calldata arweaveHash,
        bytes calldata govSign
    ) external returns (uint256) {
        uint256 tokenId = uint256(h3Hash);
        
        // 1. Check if already minted
        if (_ownerOf(tokenId) != address(0)) revert LandAlreadyMinted(tokenId);
        
        // 2. Reconstruct the exact same message hash signed by the Gov
        // Order: msg.sender (Citizen), h3Hash (bytes32), arweaveHash (string)
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, h3Hash, arweaveHash)
        );
        
        // 3. Convert to Ethereum Signed Message format
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        
        // 4. Recover and Verify
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, govSign);
        
        if (recoveredSigner != governmentAddress) {
            revert SignatureMismatch(recoveredSigner, governmentAddress);
        }
        
        // 5. Mint
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, arweaveHash);
        _allMintedTokens.push(tokenId);
        
        emit LandMinted(tokenId, msg.sender, h3Hash, arweaveHash);
        return tokenId;
    }
    
    // Marketplace logic
    function listLand(uint256 tokenId, uint256 price) external {
        if (ownerOf(tokenId) != msg.sender) revert NotLandOwner();
        if (price == 0) revert InvalidPrice();
        if (listings[tokenId].isActive) revert LandAlreadyListed();
        
        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            isActive: true
        });
        
        activeListings.push(tokenId);
        emit LandListed(tokenId, msg.sender, price);
    }
    
    function buyLand(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        if (!listing.isActive) revert LandNotListed();
        if (msg.value < listing.price) revert InsufficientPayment();
        
        address seller = listing.seller;
        uint256 price = listing.price;
        
        listing.isActive = false;
        _removeFromActiveListings(tokenId);
        
        _transfer(seller, msg.sender, tokenId);
        
        (bool success, ) = payable(seller).call{value: price}("");
        if (!success) revert TransferFailed();
        
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit LandSold(tokenId, seller, msg.sender, price);
    }
    
    function unlistLand(uint256 tokenId) external {
        if (listings[tokenId].seller != msg.sender) revert NotAuthorized();
        listings[tokenId].isActive = false;
        _removeFromActiveListings(tokenId);
        emit LandUnlisted(tokenId);
    }
    
    // View Helpers
    function getAllMintedTokens() external view returns (uint256[] memory) {
        return _allMintedTokens;
    }
    
    function totalSupply() external view returns (uint256) {
        return _allMintedTokens.length;
    }

    function getH3Hash(uint256 tokenId) external pure returns (bytes32) {
        return bytes32(tokenId);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
    
    function getActiveListings() external view returns (uint256[] memory) {
        return activeListings;
    }

    function getLandsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory result = new uint256[](balance);
        uint256 counter = 0;
        for (uint256 i = 0; i < _allMintedTokens.length; i++) {
            if (ownerOf(_allMintedTokens[i]) == owner) {
                result[counter] = _allMintedTokens[i];
                counter++;
                if (counter == balance) break;
            }
        }
        return result;
    }
    
    function _removeFromActiveListings(uint256 tokenId) internal {
        for (uint256 i = 0; i < activeListings.length; i++) {
            if (activeListings[i] == tokenId) {
                activeListings[i] = activeListings[activeListings.length - 1];
                activeListings.pop();
                break;
            }
        }
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        virtual
        override
        returns (address)
    {
        if (listings[tokenId].isActive && msg.sender != address(this)) {
            listings[tokenId].isActive = false;
            _removeFromActiveListings(tokenId);
            emit LandUnlisted(tokenId);
        }
        return super._update(to, tokenId, auth);
    }
}
