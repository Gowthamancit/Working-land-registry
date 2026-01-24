export const LAND_REGISTRY_ADDRESS = "0xCa95fB85C1f7c074D67052C56C897268D0bd01a4";

export const LAND_REGISTRY_ABI = [
    "function mint(string h3Hash, string arweaveHash, bytes govSign) external returns (uint256)",
    "function listLand(uint256 tokenId, uint256 price) external",
    "function unlistLand(uint256 tokenId) external",
    "function buyLand(uint256 tokenId) external payable",
    "function updateListingPrice(uint256 tokenId, uint256 newPrice) external",
    "function totalSupply() external view returns (uint256)",
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function tokenURI(uint256 tokenId) external view returns (string)",
    "function getH3Hash(uint256 tokenId) external view returns (string)",
    "function getListing(uint256 tokenId) external view returns (tuple(uint256 tokenId, address seller, uint256 price, bool isActive))",
    "function getActiveListings() external view returns (uint256[])",
    "function getLandsByOwner(address owner) external view returns (uint256[])",
    "event LandMinted(uint256 indexed tokenId, address indexed owner, string h3Hash, string arweaveHash)",
    "event LandListed(uint256 indexed tokenId, address indexed seller, uint256 price)",
    "event LandSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)"
];
