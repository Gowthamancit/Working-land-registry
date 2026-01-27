import React, { useState, useEffect, useCallback } from 'react';
import {
    User,
    MapPin,
    ShoppingBag,
    Tag,
    Wallet,
    Hash,
    Copy,
    ExternalLink,
    Loader2,
    PlusCircle,
    RefreshCw,
    Coins
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { BrowserProvider, Contract, parseEther, formatEther } from 'ethers';
import { db, COLLECTIONS } from '../firebase';
import { copyToClipboard } from '../utils/crypto';
import { LAND_REGISTRY_ABI, LAND_REGISTRY_ADDRESS } from '../contracts/LandRegistry';

interface Application {
    id: string;
    ownerAddress: string;
    h3Hash: string;
    arweaveHash: string;
    govSignature: string;
    status: string;
}

interface LandNFT {
    tokenId: number;
    h3Hash: string;
    tokenURI: string;
    owner: string;
    isListed: boolean;
    price: string;
    marketplaceName?: string;
    marketplaceLocation?: string;
}

const CitizenPortal: React.FC = () => {
    const [userAddress, setUserAddress] = useState<string | null>(null);

    // Only listen for changes IF already connected specifically to this portal
    useEffect(() => {
        if (window.ethereum && userAddress) {
            const handleAccounts = (newAccounts: any) => {
                setUserAddress(newAccounts.length > 0 ? newAccounts[0] : null);
            };
            window.ethereum.on('accountsChanged', handleAccounts);
            return () => window.ethereum?.removeListener('accountsChanged', handleAccounts);
        }
    }, [userAddress]);
    const [approvedApps, setApprovedApps] = useState<Application[]>([]);
    const [marketLands, setMarketLands] = useState<LandNFT[]>([]);
    const [isMinting, setIsMinting] = useState<string | null>(null);
    const [isBuying, setIsBuying] = useState<number | null>(null);
    const [listingPrice, setListingPrice] = useState<Record<number, string>>({});
    const [listingMetadata, setListingMetadata] = useState<Record<number, { name: string, location: string }>>({});
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeListingId, setActiveListingId] = useState<number | null>(null);

    // 1. Connect Wallet
    const connectWallet = async () => {
        try {
            if (!window.ethereum) {
                alert("Please install MetaMask!");
                return;
            }
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
            setUserAddress(accounts[0]);
        } catch (error: any) {
            console.error("Connection error:", error);
            alert(error.message || "Failed to connect wallet");
        }
    };

    // 2. Real-time Approved Applications for user
    useEffect(() => {
        if (!userAddress) return;

        const q = query(
            collection(db, COLLECTIONS.APPLICATIONS),
            where('status', '==', 'approved'),
            where('ownerAddress', '==', userAddress.trim().toLowerCase()) // Ensure case consistency
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const apps: Application[] = [];
            querySnapshot.forEach((doc) => {
                apps.push({ id: doc.id, ...doc.data() } as Application);
            });
            setApprovedApps(apps);
        });

        return () => unsubscribe();
    }, [userAddress]);

    // 3. Fetch Marketplace Content
    const fetchMarketplace = useCallback(async () => {
        if (!window.ethereum) return;
        setIsRefreshing(true);
        try {
            const provider = new BrowserProvider(window.ethereum);
            const contract = new Contract(LAND_REGISTRY_ADDRESS, LAND_REGISTRY_ABI, provider);

            const total = await contract.totalSupply();
            const lands: LandNFT[] = [];

            for (let i = 1; i <= Number(total); i++) {
                const owner = await contract.ownerOf(i);
                const h3 = await contract.getH3Hash(i);
                const uri = await contract.tokenURI(i);
                const listing = await contract.getListing(i);

                // Fetch metadata from Firestore if available
                let mpName = `Property #${i}`;
                let mpLoc = "Verified Records";
                const q = query(collection(db, COLLECTIONS.APPLICATIONS), where("tokenId", "==", i));
                const mpSnap = await getDocs(q);
                if (!mpSnap.empty) {
                    const data = mpSnap.docs[0].data();
                    if (data.marketplaceName) mpName = data.marketplaceName;
                    if (data.marketplaceLocation) mpLoc = data.marketplaceLocation;
                }

                lands.push({
                    tokenId: i,
                    h3Hash: h3,
                    tokenURI: uri,
                    owner: owner.toLowerCase(),
                    isListed: listing.isActive,
                    price: formatEther(listing.price),
                    marketplaceName: mpName,
                    marketplaceLocation: mpLoc
                });
            }
            setMarketLands(lands);
        } catch (error) {
            console.error("Marketplace fetch error:", error);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchMarketplace();
    }, [fetchMarketplace]);

    // 4. Mint Land NFT
    const mintNFT = async (app: Application) => {
        try {
            setIsMinting(app.id);
            if (!window.ethereum) throw new Error("MetaMask not found");

            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new Contract(LAND_REGISTRY_ADDRESS, LAND_REGISTRY_ABI, signer);

            // Final On-chain Minting with Govt Signature
            console.log("Minting Verification:", {
                msg_sender: signer.address,
                app_owner: app.ownerAddress,
                match: signer.address.toLowerCase() === app.ownerAddress.toLowerCase()
            });
            const tx = await contract.mint(app.h3Hash, app.arweaveHash, app.govSignature);
            // Capture TokenID from Event
            const receipt = await tx.wait();
            // Note: In Ethers v6, we look for logs. 
            // Our contract emits LandMinted(uint256 indexed tokenId, address indexed owner, ...)
            const tokenId = receipt.logs[0]?.args?.[0] || receipt.logs[1]?.args?.[0];

            // Update Firestore status and store the associated TokenID
            const appRef = doc(db, COLLECTIONS.APPLICATIONS, app.id);
            await updateDoc(appRef, {
                status: 'minted',
                tokenId: Number(tokenId) // Link the blockchain ID to the database record
            });

            alert("🎉 Land NFT minted successfully!");
            fetchMarketplace();
        } catch (error: any) {
            console.error("Minting error:", error);
            alert(error.reason || error.message || "Failed to mint NFT.");
        } finally {
            setIsMinting(null);
        }
    };

    // 5. List for Sale
    const listLand = async (tokenId: number) => {
        const price = listingPrice[tokenId];
        const metadata = listingMetadata[tokenId] || { name: '', location: '' };

        if (!price || parseFloat(price) <= 0) {
            alert("Please enter a valid price in ETH.");
            return;
        }

        try {
            if (!window.ethereum) return;
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new Contract(LAND_REGISTRY_ADDRESS, LAND_REGISTRY_ABI, signer);

            // 1. Blockchain Transaction
            const tx = await contract.listLand(tokenId, parseEther(price));
            await tx.wait();

            // 2. Find the application record in Firestore that matches this TokenID
            const q = query(collection(db, COLLECTIONS.APPLICATIONS), where("tokenId", "==", Number(tokenId)));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const appDoc = querySnapshot.docs[0];
                await updateDoc(appDoc.ref, {
                    marketplaceName: metadata.name || `Land Property #${tokenId}`,
                    marketplaceLocation: metadata.location || "Verified Location",
                    isListed: true
                });
            }

            alert("🎉 Land listed for sale!");
            setActiveListingId(null);
            fetchMarketplace();
        } catch (error: any) {
            console.error("Listing error:", error);
            alert(error.reason || "Failed to list land.");
        }
    };

    // 6. Buy Land
    const buyLand = async (land: LandNFT) => {
        try {
            setIsBuying(land.tokenId);
            if (!window.ethereum) return;
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new Contract(LAND_REGISTRY_ADDRESS, LAND_REGISTRY_ABI, signer);

            const tx = await contract.buyLand(land.tokenId, { value: parseEther(land.price) });
            await tx.wait();

            alert("🎉 Congratulations! You now own this land.");
            fetchMarketplace();
        } catch (error: any) {
            console.error("Purchase error:", error);
            alert(error.reason || "Purchase failed.");
        } finally {
            setIsBuying(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-8 animate-fadeIn">
            {/* Header & Wallet */}
            <header className="mb-12 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-green-100 p-4 rounded-2xl">
                        <User className="w-10 h-10 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none">Citizen Portal</h1>
                        <p className="text-gray-500 font-medium mt-2">Mint & Trade Your Land NFTs</p>
                    </div>
                </div>

                {!userAddress ? (
                    <button
                        onClick={connectWallet}
                        className="btn-primary bg-green-600 hover:bg-green-700 h-14 px-8 text-lg flex items-center gap-3 shadow-xl shadow-green-200"
                    >
                        <Wallet className="w-6 h-6" /> Connect MetaMask
                    </button>
                ) : (
                    <div className="bg-white px-6 py-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <span className="font-mono font-bold text-gray-600">{userAddress.slice(0, 6)}...{userAddress.slice(-4)}</span>
                    </div>
                )}
            </header>

            {/* Minting Section */}
            <section className="mb-16">
                <div className="flex items-center gap-3 mb-8">
                    <PlusCircle className="text-green-500 w-6 h-6" />
                    <h2 className="text-2xl font-black text-gray-800">Approved for Minting</h2>
                    {approvedApps.length > 0 && <span className="bg-green-100 text-green-700 text-xs font-black px-2.5 py-1 rounded-full">{approvedApps.length}</span>}
                </div>

                {!userAddress ? (
                    <div className="bg-blue-50 rounded-3xl p-12 text-center border-2 border-dashed border-blue-200">
                        <Wallet className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-blue-900 mb-2">Wallet Disconnected</h3>
                        <p className="text-blue-600 font-medium mb-6">Please connect your wallet to view and mint your approved land titles.</p>
                        <button onClick={connectWallet} className="btn-primary bg-blue-600 hover:bg-blue-700 mx-auto px-8">
                            Connect Wallet Now
                        </button>
                    </div>
                ) : approvedApps.length === 0 ? (
                    <div className="bg-gray-50 rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
                        <p className="text-gray-400 font-bold text-lg text-balance">
                            No approved applications found for: <br />
                            <span className="font-mono text-sm text-gray-500 break-all">{userAddress}</span>
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {approvedApps.map((app) => {
                            const isCorrectWallet = userAddress?.toLowerCase() === app.ownerAddress.toLowerCase();

                            return (
                                <div key={app.id} className={`card border-t-4 transition-all duration-300 ${isCorrectWallet ? 'border-green-500 hover:scale-[1.02]' : 'border-red-400 opacity-80'}`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`p-3 rounded-xl ${isCorrectWallet ? 'bg-green-50' : 'bg-red-50'}`}>
                                            <MapPin className={`${isCorrectWallet ? 'text-green-600' : 'text-red-600'} w-6 h-6`} />
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded ${isCorrectWallet ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                                            {isCorrectWallet ? 'Ready' : 'Wrong Wallet'}
                                        </span>
                                    </div>

                                    <div className="space-y-4 mb-6">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Geohash (H3)</label>
                                            <div className="flex items-center justify-between font-mono text-sm bg-gray-50 p-2 rounded">
                                                <span>{app.h3Hash}</span>
                                                <Copy onClick={() => copyToClipboard(app.h3Hash)} className="w-4 h-4 text-gray-300 hover:text-green-600 cursor-pointer" />
                                            </div>
                                        </div>
                                        {!isCorrectWallet && (
                                            <div className="bg-red-50 p-3 rounded-xl flex items-start gap-2 border border-red-100">
                                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                                <p className="text-[10px] font-bold text-red-700 leading-tight">
                                                    This application belongs to:<br />
                                                    <span className="font-mono text-gray-500">{app.ownerAddress.slice(0, 10)}...{app.ownerAddress.slice(-8)}</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => mintNFT(app)}
                                        disabled={isMinting === app.id || !isCorrectWallet}
                                        className={`w-full btn-primary flex items-center justify-center gap-3 py-4 transition-all ${!isCorrectWallet
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-black hover:bg-gray-800 text-white shadow-lg shadow-gray-200'
                                            }`}
                                    >
                                        {isMinting === app.id ? <Loader2 className="animate-spin text-white" /> : <PlusCircle className="w-5 h-5 flex-shrink-0" />}
                                        <span className="font-black uppercase tracking-tight">
                                            {isMinting === app.id ? "Minting..." : isCorrectWallet ? "Mint Land NFT" : "Switch Wallet to Mint"}
                                        </span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Marketplace Section */}
            <section>
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <ShoppingBag className="text-indigo-500 w-6 h-6" />
                        <h2 className="text-2xl font-black text-gray-800">Land Marketplace</h2>
                    </div>
                    <button
                        onClick={fetchMarketplace}
                        className={`p-3 rounded-full hover:bg-gray-100 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {marketLands.length === 0 ? (
                    <div className="bg-gray-50 rounded-3xl p-20 text-center">
                        <Loader2 className="animate-spin w-12 h-12 text-gray-200 mx-auto" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {marketLands.map((land) => {
                            const isOwner = userAddress?.toLowerCase() === land.owner;
                            return (
                                <div key={land.tokenId} className="card group overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
                                    {/* Card Header (Image/Icon Placeholder) */}
                                    <div className="aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 -mx-6 -mt-6 mb-6 flex items-center justify-center relative">
                                        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md rounded-full p-2 text-white">
                                            <Hash className="w-5 h-5" />
                                        </div>
                                        <span className="text-6xl font-black text-white/20">#{land.tokenId}</span>
                                        <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">H3 Geohash</p>
                                            <p className="font-mono text-sm font-black text-gray-800 truncate">{land.h3Hash}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <h3 className="font-black text-gray-900 text-lg leading-tight uppercase tracking-tight">{land.marketplaceName}</h3>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <MapPin className="w-3 h-3 text-indigo-500" />
                                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">{land.marketplaceLocation}</span>
                                                </div>
                                            </div>
                                            <a href={land.tokenURI} target="_blank" rel="noreferrer" className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                                <ExternalLink className="w-5 h-5 text-gray-400 hover:text-indigo-500" />
                                            </a>
                                        </div>

                                        <div className="pt-4 border-t border-gray-100">
                                            {land.isListed ? (
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-black text-gray-900">{land.price}</span>
                                                        <span className="text-xs font-bold text-gray-400 uppercase">ETH</span>
                                                    </div>

                                                    {isOwner ? (
                                                        <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 p-2 rounded-lg justify-center font-bold text-sm">
                                                            <Tag className="w-4 h-4" /> Listed for Sale
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => buyLand(land)}
                                                            disabled={isBuying === land.tokenId}
                                                            className="w-full btn-primary bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 flex items-center justify-center gap-2"
                                                        >
                                                            {isBuying === land.tokenId ? <Loader2 className="animate-spin" /> : <Coins className="w-5 h-5" />}
                                                            {isBuying === land.tokenId ? "Buying..." : "Buy Now"}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                isOwner ? (
                                                    <div className="space-y-4">
                                                        {activeListingId === land.tokenId ? (
                                                            <div className="bg-gray-50 p-4 rounded-2xl border border-indigo-100 animate-fadeIn space-y-3">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Property Name</label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="e.g. Sunset Villa"
                                                                        className="input-field py-1.5 text-sm"
                                                                        onChange={(e) => setListingMetadata(prev => ({
                                                                            ...prev,
                                                                            [land.tokenId]: { ...(prev[land.tokenId] || { location: '' }), name: e.target.value }
                                                                        }))}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Location Description</label>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="e.g. Near Downtown"
                                                                        className="input-field py-1.5 text-sm"
                                                                        onChange={(e) => setListingMetadata(prev => ({
                                                                            ...prev,
                                                                            [land.tokenId]: { ...(prev[land.tokenId] || { name: '' }), location: e.target.value }
                                                                        }))}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Price (ETH)</label>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="0.00"
                                                                        className="input-field py-1.5 text-sm"
                                                                        onChange={(e) => setListingPrice(prev => ({ ...prev, [land.tokenId]: e.target.value }))}
                                                                    />
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => setActiveListingId(null)}
                                                                        className="flex-1 py-2 bg-gray-200 text-gray-600 rounded-lg font-bold text-xs"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={() => listLand(land.tokenId)}
                                                                        className="flex-2 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-lg shadow-indigo-100"
                                                                    >
                                                                        Confirm Listing
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setActiveListingId(land.tokenId)}
                                                                className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all"
                                                            >
                                                                <Tag className="w-4 h-4" /> List for Sale
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-4 bg-gray-50 rounded-xl">
                                                        <p className="text-sm font-bold text-gray-400">Not for Sale</p>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
};

export default CitizenPortal;
