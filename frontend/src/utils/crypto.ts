import * as h3 from "h3-js";
import { solidityPackedKeccak256, keccak256, toUtf8Bytes } from "ethers";

/**
 * Helper to calculate the centroid (geometric center) of a polygon.
 */
const getPolygonCentroid = (coords: [number, number][]): [number, number] => {
    let latSum = 0;
    let lngSum = 0;
    coords.forEach(([lat, lng]) => {
        latSum += lat;
        lngSum += lng;
    });
    return [latSum / coords.length, lngSum / coords.length];
};

/**
 * Generates an H3 Geometry Hash for a given set of coordinates (polygon).
 * 1. Covers the polygon with H3 cells at Res 9.
 * 2. If too small, falls back to the centroid cell.
 * 3. Sorts cells and joins them for determinism.
 * 4. Hashes the result for a single unique ID to be used in the Smart Contract.
 * @param coordinates Array of [lat, lng] pairs
 * @returns string 0x-prefixed Keccak-256 hash
 */
export const generateH3Hash = (coordinates: [number, number][]): string => {
    const RESOLUTION = 9;
    let h3Array: string[] = [];

    try {
        // Attempt to get cells covering the polygon (Single loop outer boundary)
        const polygon = [coordinates];
        h3Array = h3.polygonToCells(polygon, RESOLUTION);

        // Centroid Fallback if polygon is too small to contain a cell center
        if (h3Array.length === 0) {
            const centroid = getPolygonCentroid(coordinates);
            const centerCell = h3.latLngToCell(centroid[0], centroid[1], RESOLUTION);
            h3Array.push(centerCell);
        }

        // Sort for determinism (CRITICAL for consistent hashing across platforms)
        h3Array.sort();

        // Concatenate and hash the result to create a single H_Geometry ID
        const concatenatedH3String = h3Array.join('');

        // Compute Keccak-256 hash of the joined string
        return keccak256(toUtf8Bytes(concatenatedH3String));

    } catch (error: any) {
        console.error("H3 Hashing Error:", error);
        // Ultimate fallback using the first point
        const fallbackCell = h3.latLngToCell(coordinates[0][0], coordinates[0][1], RESOLUTION);
        return keccak256(toUtf8Bytes(fallbackCell));
    }
};

/**
 * Reconstructs the info-hash used for government signatures.
 * Matches Solidity's keccak256(abi.encodePacked(owner, h3, arweave)) exactly.
 * @param owner Wallet address of the land owner
 * @param h3Hash H3 Geohash string
 * @param arweaveHash Arweave document hash
 * @returns string 32-byte hex string (hash)
 */
export const generateInfoHash = (
    owner: string,
    h3Hash: string,
    arweaveHash: string
): string => {
    return solidityPackedKeccak256(
        ["address", "string", "string"],
        [owner, h3Hash, arweaveHash]
    );
};

/**
 * Copies text to clipboard and shows a simple UI notification.
 * @param text The string to copy
 * @param label A label for the notification (e.g., "Hash copied!")
 */
export const copyToClipboard = async (text: string, label: string = "Copied to clipboard!") => {
    try {
        await navigator.clipboard.writeText(text);

        // Simple UI Notification using a temporary DOM element
        const notification = document.createElement("div");
        notification.className = "fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 notification-enter transition-all duration-300";
        notification.innerText = label;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = "0";
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
    } catch (err) {
        console.error("Failed to copy:", err);
    }
};
