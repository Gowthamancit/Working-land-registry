// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LandRegistry
 * @dev Decentralized Land Registry with Government Signature Verification
 * @notice This contract implements a blockchain-based land registry system where:
 * - Government acts as a "Judge" to verify land ownership before minting
 * - Surveyors can be whitelisted to submit land data
 * - Land parcels are represented as NFTs with H3 geohash IDs
 * - Built-in marketplace for listing and buying land
 */
contract LandRegistry is ERC721URIStorage, Ownable, ReentrancyGuard {

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice The government address that signs minting approvals
    address public governmentAddress;
    
    /// @notice Mapping of whitelisted surveyor addresses
    mapping(address => bool) public whitelistedSurveyors;
    
    /// @notice Counter for token IDs
    uint256 private _tokenIdCounter;
    
    /// @notice Mapping from H3 hash to token ID
    mapping(string => uint256) public h3HashToTokenId;
    
    /// @notice Mapping from token ID to H3 hash
    mapping(uint256 => string) public tokenIdToH3Hash;
    
    /// @notice Mapping to track if an H3 hash has been minted
    mapping(string => bool) public isMinted;
    
    // Marketplace structures
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool isActive;
    }
    
    /// @notice Mapping from token ID to listing details
    mapping(uint256 => Listing) public listings;
    
    /// @notice Array of all active listing token IDs
    uint256[] public activeListings;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event GovernmentAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event SurveyorWhitelisted(address indexed surveyor);
    event SurveyorRemoved(address indexed surveyor);
    event LandMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string h3Hash,
        string arweaveHash
    );
    event LandListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );
    event LandUnlisted(uint256 indexed tokenId);
    event LandSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );
    
    // ============================================
    // ERRORS
    // ============================================
    
    error InvalidGovernmentAddress();
    error InvalidSignature();
    error LandAlreadyMinted();
    error NotAuthorized();
    error InvalidPrice();
    error LandNotListed();
    error InsufficientPayment();
    error LandAlreadyListed();
    error NotLandOwner();
    error TransferFailed();
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @dev Initializes the contract with government address
     * @param _governmentAddress The address of the government authority
     */
    constructor(address _governmentAddress) 
        ERC721("LandRegistry", "LAND") 
        Ownable(msg.sender) 
    {
        if (_governmentAddress == address(0)) revert InvalidGovernmentAddress();
        governmentAddress = _governmentAddress;
        _tokenIdCounter = 1; // Start token IDs from 1
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @notice Updates the government address
     * @param _newGovernmentAddress The new government address
     */
    function setGovernmentAddress(address _newGovernmentAddress) external onlyOwner {
        if (_newGovernmentAddress == address(0)) revert InvalidGovernmentAddress();
        address oldAddress = governmentAddress;
        governmentAddress = _newGovernmentAddress;
        emit GovernmentAddressUpdated(oldAddress, _newGovernmentAddress);
    }
    
    /**
     * @notice Adds a surveyor to the whitelist
     * @param _surveyor The surveyor address to whitelist
     */
    function whitelistSurveyor(address _surveyor) external onlyOwner {
        whitelistedSurveyors[_surveyor] = true;
        emit SurveyorWhitelisted(_surveyor);
    }
    
    /**
     * @notice Removes a surveyor from the whitelist
     * @param _surveyor The surveyor address to remove
     */
    function removeSurveyor(address _surveyor) external onlyOwner {
        whitelistedSurveyors[_surveyor] = false;
        emit SurveyorRemoved(_surveyor);
    }
    
    /**
     * @notice Batch whitelist multiple surveyors
     * @param _surveyors Array of surveyor addresses
     */
    function batchWhitelistSurveyors(address[] calldata _surveyors) external onlyOwner {
        for (uint256 i = 0; i < _surveyors.length; i++) {
            whitelistedSurveyors[_surveyors[i]] = true;
            emit SurveyorWhitelisted(_surveyors[i]);
        }
    }
    
    // ============================================
    // CORE MINTING FUNCTION (THE "JUDGE")
    // ============================================
    
    /**
     * @notice Mints a new land NFT with government signature verification
     * @dev This is the "Judge" function that verifies government approval
     * @param h3Hash The H3 geohash of the land parcel
     * @param arweaveHash The Arweave hash containing land documents
     * @param govSign The government's signature approving this mint
     * @return tokenId The minted token ID
     */
    function mint(
        string memory h3Hash,
        string memory arweaveHash,
        bytes memory govSign
    ) external returns (uint256) {
        // Check if land is already minted
        if (isMinted[h3Hash]) revert LandAlreadyMinted();
        
        // Reconstruct the message hash that was signed by the government
        // Hash format: keccak256(abi.encodePacked(ownerAddress, h3Hash, arweaveHash))
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, h3Hash, arweaveHash)
        );
        
        // Convert to Ethereum Signed Message format
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        
        // Recover the signer address from the signature
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, govSign);
        
        // Verify that the signature is from the government address
        if (recoveredSigner != governmentAddress) revert InvalidSignature();
        
        // All checks passed - mint the NFT
        uint256 tokenId = _tokenIdCounter++;
        
        // Mint the NFT to the caller
        _safeMint(msg.sender, tokenId);
        
        // Set the token URI (Arweave hash)
        _setTokenURI(tokenId, arweaveHash);
        
        // Store the mappings
        h3HashToTokenId[h3Hash] = tokenId;
        tokenIdToH3Hash[tokenId] = h3Hash;
        isMinted[h3Hash] = true;
        
        emit LandMinted(tokenId, msg.sender, h3Hash, arweaveHash);
        
        return tokenId;
    }
    
    // ============================================
    // MARKETPLACE FUNCTIONS
    // ============================================
    
    /**
     * @notice Lists a land NFT for sale
     * @param tokenId The token ID to list
     * @param price The listing price in wei
     */
    function listLand(uint256 tokenId, uint256 price) external {
        // Verify ownership
        if (ownerOf(tokenId) != msg.sender) revert NotLandOwner();
        
        // Check valid price
        if (price == 0) revert InvalidPrice();
        
        // Check if already listed
        if (listings[tokenId].isActive) revert LandAlreadyListed();
        
        // Create listing
        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            isActive: true
        });
        
        // Add to active listings array
        activeListings.push(tokenId);
        
        emit LandListed(tokenId, msg.sender, price);
    }
    
    /**
     * @notice Removes a land listing
     * @param tokenId The token ID to unlist
     */
    function unlistLand(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        
        // Check if listed
        if (!listing.isActive) revert LandNotListed();
        
        // Verify ownership
        if (listing.seller != msg.sender) revert NotAuthorized();
        
        // Remove listing
        listing.isActive = false;
        
        // Remove from active listings array
        _removeFromActiveListings(tokenId);
        
        emit LandUnlisted(tokenId);
    }
    
    /**
     * @notice Buys a listed land NFT
     * @dev Automatically transfers NFT when correct payment is received
     * @param tokenId The token ID to purchase
     */
    function buyLand(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        
        // Check if listed
        if (!listing.isActive) revert LandNotListed();
        
        // Verify payment amount
        if (msg.value < listing.price) revert InsufficientPayment();
        
        address seller = listing.seller;
        uint256 price = listing.price;
        
        // Mark as inactive before transfer
        listing.isActive = false;
        
        // Remove from active listings array
        _removeFromActiveListings(tokenId);
        
        // Transfer the NFT to the buyer
        _transfer(seller, msg.sender, tokenId);
        
        // Transfer payment to seller
        (bool success, ) = payable(seller).call{value: price}("");
        if (!success) revert TransferFailed();
        
        // Refund excess payment if any
        if (msg.value > price) {
            uint256 refund = msg.value - price;
            (bool refundSuccess, ) = payable(msg.sender).call{value: refund}("");
            if (!refundSuccess) revert TransferFailed();
        }
        
        emit LandSold(tokenId, seller, msg.sender, price);
    }
    
    /**
     * @notice Updates the price of a listed land
     * @param tokenId The token ID
     * @param newPrice The new price in wei
     */
    function updateListingPrice(uint256 tokenId, uint256 newPrice) external {
        Listing storage listing = listings[tokenId];
        
        // Check if listed
        if (!listing.isActive) revert LandNotListed();
        
        // Verify ownership
        if (listing.seller != msg.sender) revert NotAuthorized();
        
        // Check valid price
        if (newPrice == 0) revert InvalidPrice();
        
        listing.price = newPrice;
        
        emit LandListed(tokenId, msg.sender, newPrice);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Gets listing details for a token
     * @param tokenId The token ID
     * @return listing The listing details
     */
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
    
    /**
     * @notice Gets all active listings
     * @return Array of active listing token IDs
     */
    function getActiveListings() external view returns (uint256[] memory) {
        return activeListings;
    }
    
    /**
     * @notice Gets listing details for multiple tokens
     * @param tokenIds Array of token IDs
     * @return Array of listing details
     */
    function getBatchListings(uint256[] calldata tokenIds) 
        external 
        view 
        returns (Listing[] memory) 
    {
        Listing[] memory result = new Listing[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            result[i] = listings[tokenIds[i]];
        }
        return result;
    }
    
    /**
     * @notice Checks if an address is a whitelisted surveyor
     * @param surveyor The address to check
     * @return bool True if whitelisted
     */
    function isSurveyorWhitelisted(address surveyor) external view returns (bool) {
        return whitelistedSurveyors[surveyor];
    }
    
    /**
     * @notice Gets the H3 hash for a token ID
     * @param tokenId The token ID
     * @return The H3 hash
     */
    function getH3Hash(uint256 tokenId) external view returns (string memory) {
        return tokenIdToH3Hash[tokenId];
    }
    
    /**
     * @notice Gets the token ID for an H3 hash
     * @param h3Hash The H3 hash
     * @return The token ID
     */
    function getTokenIdByH3(string memory h3Hash) external view returns (uint256) {
        return h3HashToTokenId[h3Hash];
    }
    
    /**
     * @notice Gets all lands owned by an address
     * @param owner The owner address
     * @return Array of token IDs
     */
    function getLandsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory ownedTokens = new uint256[](balance);
        uint256 currentIndex = 0;
        
        for (uint256 i = 1; i < _tokenIdCounter && currentIndex < balance; i++) {
            if (_ownerOf(i) == owner) {
                ownedTokens[currentIndex] = i;
                currentIndex++;
            }
        }
        
        return ownedTokens;
    }
    
    /**
     * @notice Gets the total number of minted lands
     * @return Total supply
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter - 1;
    }
    
    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    /**
     * @dev Removes a token ID from the active listings array
     * @param tokenId The token ID to remove
     */
    function _removeFromActiveListings(uint256 tokenId) internal {
        for (uint256 i = 0; i < activeListings.length; i++) {
            if (activeListings[i] == tokenId) {
                // Move the last element to this position and pop
                activeListings[i] = activeListings[activeListings.length - 1];
                activeListings.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Override to prevent transfer of listed lands
     * @param to The recipient address
     * @param tokenId The token ID
     * @param auth The authorized address
     * @return The previous owner
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        virtual
        override
        returns (address)
    {
        // If land is listed and this is not a marketplace sale, unlist it
        if (listings[tokenId].isActive && msg.sender != address(this)) {
            listings[tokenId].isActive = false;
            _removeFromActiveListings(tokenId);
            emit LandUnlisted(tokenId);
        }
        
        return super._update(to, tokenId, auth);
    }
}
