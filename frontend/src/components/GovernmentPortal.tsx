import React, { useState, useEffect } from 'react';
import { Landmark, ShieldCheck, XCircle, CheckCircle2, PenTool, Loader2, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { BrowserProvider, verifyMessage } from 'ethers';
import { db, COLLECTIONS } from '../firebase';
import { generateInfoHash, copyToClipboard } from '../utils/crypto';

interface Application {
    id: string;
    ownerAddress: string;
    h3Hash: string;
    arweaveHash: string;
    surveyorSignature: string;
    status: string;
    timestamp: any;
}

const GovernmentPortal: React.FC = () => {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [validationResults, setValidationResults] = useState<Record<string, { isValid: boolean; address: string }>>({});
    const [govAddress, setGovAddress] = useState<string | null>(null);

    // Only listen for changes IF already connected specifically to this portal
    useEffect(() => {
        if (window.ethereum && govAddress) {
            const handleAccounts = (newAccounts: any) => {
                setGovAddress(newAccounts.length > 0 ? newAccounts[0] : null);
            };
            window.ethereum.on('accountsChanged', handleAccounts);
            return () => window.ethereum?.removeListener('accountsChanged', handleAccounts);
        }
    }, [govAddress]);

    const connectWallet = async () => {
        try {
            if (!window.ethereum) {
                alert("Please install MetaMask!");
                return;
            }
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
            setGovAddress(accounts[0]);
        } catch (error: any) {
            console.error("Connection error:", error);
            alert(error.message || "Failed to connect wallet");
        }
    };

    // Real-time subscription to pending applications
    useEffect(() => {
        const q = query(
            collection(db, COLLECTIONS.APPLICATIONS),
            where('status', '==', 'pending')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const apps: Application[] = [];
            querySnapshot.forEach((doc) => {
                apps.push({ id: doc.id, ...doc.data() } as Application);
            });
            setApplications(apps);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const checkValidation = async (app: Application) => {
        try {
            setProcessingId(app.id);

            // 1. Reconstruct the info-hash
            const infoHash = generateInfoHash(app.ownerAddress, app.h3Hash, app.arweaveHash);

            // 2. Perform ecrecover (verifyMessage returns the signer address)
            const recoveredAddress = verifyMessage(infoHash, app.surveyorSignature);

            // 3. Check if address is in whitelisted_surveyors list in Firestore
            const surveyorsRef = collection(db, COLLECTIONS.SURVEYORS);
            const q = query(surveyorsRef, where('address', '==', recoveredAddress.toLowerCase()), where('isWhitelisted', '==', true));
            const querySnapshot = await getDocs(q);

            const isValid = !querySnapshot.empty;

            setValidationResults(prev => ({
                ...prev,
                [app.id]: { isValid, address: recoveredAddress }
            }));
        } catch (error) {
            console.error("Validation error:", error);
            alert("Error validating signature format.");
        } finally {
            setProcessingId(null);
        }
    };

    const signApplication = async (app: Application) => {
        if (!govAddress) {
            alert("Please connect your official Government wallet first.");
            return;
        }

        const validation = validationResults[app.id];
        if (!validation || !validation.isValid) {
            alert("Cannot sign an invalid or unverified application.");
            return;
        }

        try {
            setProcessingId(app.id);

            const provider = new BrowserProvider(window.ethereum!);
            const signer = await provider.getSigner();

            // Reconstruct hash for gov signature
            const infoHash = generateInfoHash(app.ownerAddress, app.h3Hash, app.arweaveHash);

            // Trigger MetaMask signature for the Government official
            const govSignature = await signer.signMessage(infoHash);

            // Update Firestore with govSign and Approved status
            const appRef = doc(db, COLLECTIONS.APPLICATIONS, app.id);
            await updateDoc(appRef, {
                govSignature: govSignature,
                status: 'approved',
                approvedAt: new Date().toISOString(),
                approverAddress: govAddress.toLowerCase()
            });

            // Clear local validation result
            const newResults = { ...validationResults };
            delete newResults[app.id];
            setValidationResults(newResults);

            alert("Application successfully approved and signed by Government!");
        } catch (error: any) {
            console.error("Signing error:", error);
            alert(error.message || "Failed to sign application.");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-8 animate-fadeIn">
            <header className="mb-12 flex justify-between items-center">
                <div>
                    <div className="inline-block p-3 bg-red-100 rounded-full mb-4">
                        <Landmark className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Government Portal</h1>
                    <p className="mt-2 text-lg text-gray-600 font-medium italic border-l-4 border-red-500 pl-4">Authorization & Registry Control</p>
                </div>
                <div className="flex flex-col items-end gap-4">
                    {!govAddress ? (
                        <button
                            onClick={connectWallet}
                            className="btn-primary bg-red-600 hover:bg-red-700 flex items-center gap-2 px-6 shadow-red-200"
                        >
                            <ShieldCheck className="w-5 h-5" /> Authorized Access
                        </button>
                    ) : (
                        <div className="bg-white px-6 py-2 rounded-full border border-red-200 shadow-sm flex items-center gap-3">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="font-mono text-sm font-bold text-gray-600">
                                {govAddress.slice(0, 6)}...{govAddress.slice(-4)}
                            </span>
                        </div>
                    )}
                    <div className="text-right">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending Review: {applications.length}</span>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center py-20">
                    <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-4" />
                    <p className="text-gray-500 font-bold">Synchronizing with Registry...</p>
                </div>
            ) : applications.length === 0 ? (
                <div className="card text-center py-20 border-2 border-dashed border-gray-200">
                    <ShieldCheck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <p className="text-xl font-bold text-gray-400">No pending applications for review.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {applications.map((app) => (
                        <div key={app.id} className="card border-l-8 border-red-500 hover:shadow-xl transition-all duration-300 group">
                            <div className="flex flex-wrap md:flex-nowrap gap-8 items-start">
                                {/* Details Section */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-full">Pending Review</span>
                                        <span className="text-[10px] font-mono text-gray-400">ID: {app.id}</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Owner Address</label>
                                            <div className="flex items-center gap-2 group/addr">
                                                <span className="font-mono text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded truncate flex-1">{app.ownerAddress}</span>
                                                <Copy onClick={() => copyToClipboard(app.ownerAddress)} className="w-4 h-4 text-gray-300 cursor-pointer hover:text-red-500 transition-colors" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Land Geohash (H3)</label>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded">{app.h3Hash}</span>
                                                <ExternalLink className="w-4 h-4 text-gray-300 cursor-pointer hover:text-red-500 transition-colors" />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Surveyor Signature</label>
                                        <div className="text-[10px] font-mono p-3 bg-gray-100 rounded-lg text-gray-500 break-all leading-relaxed line-clamp-2 italic">
                                            {app.surveyorSignature}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Section */}
                                <div className="w-full md:w-64 space-y-3 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                    {!validationResults[app.id] ? (
                                        <button
                                            onClick={() => checkValidation(app)}
                                            disabled={processingId === app.id}
                                            className="btn-primary w-full bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2"
                                        >
                                            {processingId === app.id ? <Loader2 className="animate-spin w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                            Check Valid
                                        </button>
                                    ) : validationResults[app.id].isValid ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg border border-green-100 animate-fadeIn">
                                                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                                <div className="overflow-hidden">
                                                    <p className="text-[10px] font-black uppercase">Valid Surveyor</p>
                                                    <p className="text-[9px] font-mono truncate">{validationResults[app.id].address}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => signApplication(app)}
                                                disabled={processingId === app.id}
                                                className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg hover:shadow-red-200"
                                            >
                                                {processingId === app.id ? <Loader2 className="animate-spin w-4 h-4" /> : <PenTool className="w-4 h-4" />}
                                                Authorize & Sign
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 animate-fadeIn">
                                                <XCircle className="w-5 h-5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-[10px] font-black uppercase">Invalid Signer</p>
                                                    <p className="text-[9px] font-mono truncate">{validationResults[app.id].address}</p>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-red-100/50 rounded-lg text-[10px] text-red-700 font-bold flex gap-2">
                                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                                Signer is not a whitelisted surveyor!
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GovernmentPortal;
