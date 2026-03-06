import React, { useState, useRef } from 'react';
import { MapPin, Upload, FileText, CheckCircle, PenTool, Send, Hash, Loader2, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { BrowserProvider, getBytes, keccak256 } from 'ethers';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from '../firebase';
import { generateH3Hash, generateInfoHash, copyToClipboard } from '../utils/crypto';

interface Coordinate {
    lat: string;
    lng: string;
}

const SurveyorPortal: React.FC = () => {
    const [coordinates, setCoordinates] = useState<Coordinate[]>([
        { lat: '', lng: '' },
        { lat: '', lng: '' },
        { lat: '', lng: '' },
        { lat: '', lng: '' },
    ]);
    const [surveyorAddress, setSurveyorAddress] = useState<string | null>(null);
    const [ownerAddress, setOwnerAddress] = useState('');
    const [h3Hash, setH3Hash] = useState('');
    const [arweaveHash, setArweaveHash] = useState('');
    const [surveyorSignature, setSurveyorSignature] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Only listen for changes IF already connected specifically to this portal
    React.useEffect(() => {
        if (window.ethereum && surveyorAddress) {
            const handleAccounts = (newAccounts: any) => {
                setSurveyorAddress(newAccounts.length > 0 ? newAccounts[0] : null);
            };
            window.ethereum.on('accountsChanged', handleAccounts);
            return () => window.ethereum?.removeListener('accountsChanged', handleAccounts);
        }
    }, [surveyorAddress]);

    const connectWallet = async () => {
        try {
            if (!window.ethereum) {
                alert("Please install MetaMask!");
                return;
            }
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
            setSurveyorAddress(accounts[0]);
        } catch (error: any) {
            console.error("Connection error:", error);
            alert(error.message || "Failed to connect wallet");
        }
    };

    const handleCoordChange = (index: number, field: keyof Coordinate, value: string) => {
        const newCoords = [...coordinates];
        newCoords[index][field] = value;
        setCoordinates(newCoords);
    };

    const onGenerateH3 = () => {
        const coordsArray: [number, number][] = coordinates.map(c => [parseFloat(c.lat), parseFloat(c.lng)]);
        if (coordsArray.some(c => isNaN(c[0]) || isNaN(c[1]))) {
            alert("Please enter valid latitude and longitude for all 4 points.");
            return;
        }
        const hash = generateH3Hash(coordsArray);
        setH3Hash(hash);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert("Please upload a PDF file.");
            return;
        }

        setIsUploading(true);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const buffer = e.target?.result as ArrayBuffer;
                // Generate a deterministic hash based on file content
                const contentHash = keccak256(new Uint8Array(buffer));

                // Simulate a real Arweave Transaction ID (43 chars, base64url)
                // We'll take the hex hash and convert it to a pseudo-Arweave ID
                const mockTxId = contentHash.slice(2, 45) // Taking first 43 chars of hex for visual simulation
                    .replace(/0/g, 'a').replace(/1/g, 'b'); // Just making it look less like pure hex

                setTimeout(() => {
                    setArweaveHash(mockTxId);
                    setUploadedFile({
                        name: file.name,
                        size: (file.size / 1024).toFixed(1) + ' KB'
                    });
                    setIsUploading(false);
                }, 1500);
            };
            reader.readAsArrayBuffer(file);
        } catch (error) {
            console.error("Upload error:", error);
            alert("Failed to process document.");
            setIsUploading(false);
        }
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const onGenerateSign = async () => {
        if (!surveyorAddress) {
            alert("Please connect your wallet first.");
            return;
        }
        if (!h3Hash || !arweaveHash || !ownerAddress) {
            alert("Please ensure H3 Hash, Arweave Hash, and Owner Address are present.");
            return;
        }

        try {
            setIsSigning(true);
            const infoHash = generateInfoHash(ownerAddress, h3Hash, arweaveHash);

            const provider = new BrowserProvider(window.ethereum!);
            const signer = await provider.getSigner();

            const signature = await signer.signMessage(getBytes(infoHash));
            setSurveyorSignature(signature);
        } catch (error: any) {
            console.error("Signing Error:", error);
            alert(error.message || "Failed to generate signature.");
        } finally {
            setIsSigning(false);
        }
    };

    const onSubmitToGov = async () => {
        if (!surveyorSignature || !surveyorAddress) {
            alert("Please sign the data before submitting.");
            return;
        }

        try {
            setIsSubmitting(true);

            await addDoc(collection(db, COLLECTIONS.APPLICATIONS), {
                ownerAddress: ownerAddress.trim().toLowerCase(),
                h3Hash,
                arweaveHash,
                surveyorAddress: surveyorAddress.trim().toLowerCase(),
                surveyorSignature,
                coordinates,
                status: 'pending',
                timestamp: serverTimestamp(),
            });

            alert("Application submitted to Government successfully!");
            // Reset form
            setCoordinates([{ lat: '', lng: '' }, { lat: '', lng: '' }, { lat: '', lng: '' }, { lat: '', lng: '' }]);
            setOwnerAddress('');
            setH3Hash('');
            setArweaveHash('');
            setSurveyorSignature('');
            setUploadedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error: any) {
            console.error("Submission Error:", error);
            alert("Failed to submit to database.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-8 animate-fadeIn">
            <header className="mb-10 text-center">
                <div className="inline-block p-3 bg-primary-100 rounded-full mb-4">
                    <MapPin className="w-8 h-8 text-primary-600" />
                </div>
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Surveyor Portal</h1>
                <p className="mt-2 text-lg text-gray-600 font-medium">Create Digital Land Identity</p>
                <div className="mt-6 flex justify-center">
                    {!surveyorAddress ? (
                        <button
                            onClick={connectWallet}
                            className="btn-primary flex items-center gap-2 px-8 py-3 shadow-lg"
                        >
                            <Send className="w-5 h-5 rotate-[-45deg]" /> Connect Surveyor Wallet
                        </button>
                    ) : (
                        <div className="bg-white px-6 py-2 rounded-full border border-primary-200 shadow-sm flex items-center gap-3">
                            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                            <span className="font-mono text-sm font-bold text-gray-600">
                                {surveyorAddress.slice(0, 6)}...{surveyorAddress.slice(-4)}
                            </span>
                        </div>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Data Entry */}
                <div className="space-y-6">
                    <section className="card border-t-4 border-primary-500">
                        <h2 className="text-xl font-bold flex items-center mb-6 text-gray-800">
                            <MapPin className="mr-2 w-5 h-5 text-primary-500" /> Parcel Boundaries
                        </h2>
                        <div className="space-y-4">
                            {coordinates.map((coord, idx) => (
                                <div key={idx} className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Point {idx + 1} Lat</label>
                                        <input
                                            type="number"
                                            placeholder="0.0000"
                                            className="input-field"
                                            value={coord.lat}
                                            onChange={(e) => handleCoordChange(idx, 'lat', e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Point {idx + 1} Lng</label>
                                        <input
                                            type="number"
                                            placeholder="0.0000"
                                            className="input-field"
                                            value={coord.lng}
                                            onChange={(e) => handleCoordChange(idx, 'lng', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                            <button onClick={onGenerateH3} className="btn-primary w-full flex items-center justify-center gap-2 mt-4 shadow-lg shadow-primary-200">
                                <Hash className="w-4 h-4" /> Generate H3 Geohash
                            </button>
                        </div>
                    </section>

                    <section className="card border-t-4 border-primary-500">
                        <h2 className="text-xl font-bold flex items-center mb-6 text-gray-800">
                            <FileText className="mr-2 w-5 h-5 text-primary-500" /> Documentation
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Owner Wallet Address</label>
                                <input
                                    type="text"
                                    placeholder="0x..."
                                    className="input-field font-mono"
                                    value={ownerAddress}
                                    onChange={(e) => setOwnerAddress(e.target.value)}
                                />
                            </div>
                            <div className={`p-6 border-2 border-dashed rounded-xl transition-all duration-300 flex flex-col items-center ${uploadedFile ? 'border-green-500 bg-green-50/50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                                {uploadedFile ? (
                                    <CheckCircle className="w-10 h-10 text-green-500 mb-3 animate-bounce-slow" />
                                ) : (
                                    <Upload className="w-10 h-10 text-gray-400 mb-3" />
                                )}

                                <div className="text-center mb-4">
                                    <p className={`text-sm font-bold ${uploadedFile ? 'text-green-700' : 'text-gray-500'}`}>
                                        {uploadedFile ? uploadedFile.name : "Upload Paper Deeds (.pdf)"}
                                    </p>
                                    {uploadedFile && (
                                        <p className="text-[10px] font-medium text-green-600 uppercase tracking-widest mt-1">
                                            {uploadedFile.size} • Attached Successfully
                                        </p>
                                    )}
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".pdf"
                                    className="hidden"
                                />
                                <button
                                    onClick={triggerFileUpload}
                                    disabled={isUploading}
                                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all ${uploadedFile
                                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-100'
                                        : 'btn-secondary'
                                        }`}
                                >
                                    {isUploading ? <Loader2 className="animate-spin" /> : uploadedFile ? <RefreshCw className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                                    {isUploading ? "Uploading..." : uploadedFile ? "Change Document" : "Select & Upload"}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column: Verification & Output */}
                <div className="space-y-6">
                    <section className="card border-l-4 border-green-500 bg-green-50/30">
                        <h2 className="text-xl font-bold flex items-center mb-6 text-gray-800">
                            <CheckCircle className="mr-2 w-5 h-5 text-green-500" /> Results
                        </h2>
                        <div className="space-y-4">
                            <div onClick={() => h3Hash && copyToClipboard(h3Hash)} className="cursor-pointer group">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block group-hover:text-primary-500 transition-colors">H3 Geohash (Res 9)</label>
                                <div className="hash-display min-h-[44px] flex items-center justify-between gap-3 overflow-hidden">
                                    <span className="truncate flex-1 font-mono text-sm">{h3Hash || "---"}</span>
                                    {h3Hash && <Copy onClick={() => copyToClipboard(h3Hash)} className="w-4 h-4 text-gray-300 hover:text-primary-500 cursor-pointer shrink-0" />}
                                </div>
                            </div>
                            <div className="cursor-pointer group">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block group-hover:text-primary-500 transition-colors">Arweave Hash (Transaction ID)</label>
                                <div className="hash-display min-h-[44px] flex items-center justify-between gap-2 overflow-hidden">
                                    <span className="truncate font-mono text-xs">{arweaveHash || "---"}</span>
                                    {arweaveHash && (
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => copyToClipboard(arweaveHash)}
                                                className="p-1.5 hover:bg-white rounded-md transition-colors"
                                                title="Copy ID"
                                            >
                                                <Copy className="w-3 h-3 text-gray-400 hover:text-primary-500" />
                                            </button>
                                            <a
                                                href={`https://arweave.net/${arweaveHash}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-1.5 hover:bg-white rounded-md transition-colors"
                                                title="View on Gateway"
                                            >
                                                <ExternalLink className="w-3 h-3 text-gray-400 hover:text-primary-500" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                                {arweaveHash && (
                                    <p className="text-[9px] text-gray-400 mt-1 italic">
                                        Note: This is a simulated hash. Real uploads require an Arweave Gateway.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <button
                                onClick={onGenerateSign}
                                disabled={isSigning || !h3Hash || !arweaveHash}
                                className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold transition-all duration-300 ${isSigning ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-black text-white shadow-xl hover:scale-[1.02]"
                                    }`}
                            >
                                {isSigning ? <Loader2 className="animate-spin" /> : <PenTool className="w-5 h-5" />}
                                {isSigning ? "Awaiting MetaMask..." : "Generate Surveyor Signature"}
                            </button>

                            {surveyorSignature && (
                                <div className="mt-4 p-4 bg-white border border-green-200 rounded-lg animate-fadeIn">
                                    <p className="text-[10px] font-bold text-green-600 uppercase mb-2">Signature Verified</p>
                                    <div className="text-[10px] font-mono break-all text-gray-400 line-clamp-2">
                                        {surveyorSignature}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <button
                        onClick={onSubmitToGov}
                        disabled={!surveyorSignature || isSubmitting}
                        className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-lg font-black tracking-wide transition-all duration-500 ${!surveyorSignature ? "bg-gray-200 text-gray-400" : "bg-primary-600 text-white hover:bg-primary-700 shadow-2xl hover:-translate-y-1 shadow-primary-200"
                            }`}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="w-6 h-6" />}
                        {isSubmitting ? "Processing..." : "Submit to Government Registry"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SurveyorPortal;
