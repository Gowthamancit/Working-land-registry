export const LAND_REGISTRY_ADDRESS = "0xa340dDEFEe4f111aEd0D4c733Db46e6844670421";

export const LAND_REGISTRY_ABI = [
    "function mint(bytes32 h3Hash, string arweaveHash, bytes govSign) external returns (uint256)",
    "function listLand(uint256 tokenId, uint256 price) external",
    "function unlistLand(uint256 tokenId) external",
    "function buyLand(uint256 tokenId) external payable",
    "function updateListingPrice(uint256 tokenId, uint256 newPrice) external",
    "function totalSupply() external view returns (uint256)",
    "function getAllMintedTokens() external view returns (uint256[])",
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function tokenURI(uint256 tokenId) external view returns (string)",
    "function getH3Hash(uint256 tokenId) external view returns (bytes32)",
    "function getListing(uint256 tokenId) external view returns (tuple(uint256 tokenId, address seller, uint256 price, bool isActive))",
    "function getActiveListings() external view returns (uint256[])",
    "function getLandsByOwner(address owner) external view returns (uint256[])",
    "event LandMinted(uint256 indexed tokenId, address indexed owner, bytes32 h3Hash, string arweaveHash)",
    "event LandListed(uint256 indexed tokenId, address indexed seller, uint256 price)",
    "event LandSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)"
];
