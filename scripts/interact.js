const hre = require("hardhat");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(query) {
    return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
    console.log("\n🏛️  LandRegistry Interaction Script\n");

    // Load deployment info
    const fs = require("fs");
    const deploymentPath = `./deployments/${hre.network.name}.json`;

    if (!fs.existsSync(deploymentPath)) {
        console.log("❌ No deployment found for network:", hre.network.name);
        console.log("Please deploy the contract first using: npx hardhat run scripts/deploy.js");
        process.exit(1);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contractAddress = deploymentInfo.contractAddress;

    console.log("Network:", hre.network.name);
    console.log("Contract Address:", contractAddress);
    console.log("");

    // Get contract instance
    const LandRegistry = await hre.ethers.getContractFactory("LandRegistry");
    const landRegistry = LandRegistry.attach(contractAddress);

    const [signer] = await hre.ethers.getSigners();
    console.log("Your Address:", signer.address);
    console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address)), "ETH");
    console.log("");

    // Main menu
    while (true) {
        console.log("\n=== Main Menu ===");
        console.log("1. View Contract Info");
        console.log("2. Whitelist Surveyor");
        console.log("3. Generate Government Signature");
        console.log("4. Mint Land NFT");
        console.log("5. List Land for Sale");
        console.log("6. View Active Listings");
        console.log("7. Buy Land");
        console.log("8. View My Lands");
        console.log("9. Exit");
        console.log("");

        const choice = await question("Select an option (1-9): ");

        switch (choice.trim()) {
            case "1":
                await viewContractInfo(landRegistry);
                break;
            case "2":
                await whitelistSurveyor(landRegistry);
                break;
            case "3":
                await generateSignature(signer);
                break;
            case "4":
                await mintLand(landRegistry, signer);
                break;
            case "5":
                await listLandForSale(landRegistry);
                break;
            case "6":
                await viewActiveListings(landRegistry);
                break;
            case "7":
                await buyLand(landRegistry);
                break;
            case "8":
                await viewMyLands(landRegistry, signer);
                break;
            case "9":
                console.log("\n👋 Goodbye!\n");
                rl.close();
                process.exit(0);
            default:
                console.log("❌ Invalid choice. Please try again.");
        }
    }
}

async function viewContractInfo(landRegistry) {
    console.log("\n📊 Contract Information:");
    console.log("─".repeat(50));
    console.log("Name:", await landRegistry.name());
    console.log("Symbol:", await landRegistry.symbol());
    console.log("Government Address:", await landRegistry.governmentAddress());
    console.log("Owner:", await landRegistry.owner());
    console.log("Total Lands Minted:", (await landRegistry.totalSupply()).toString());
    console.log("─".repeat(50));
}

async function whitelistSurveyor(landRegistry) {
    console.log("\n➕ Whitelist Surveyor");
    const surveyorAddress = await question("Enter surveyor address: ");

    try {
        const tx = await landRegistry.whitelistSurveyor(surveyorAddress);
        console.log("⏳ Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Surveyor whitelisted successfully!");
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

async function generateSignature(signer) {
    console.log("\n🔐 Generate Government Signature");
    console.log("NOTE: This should be run by the government account\n");

    const ownerAddress = await question("Enter owner address: ");
    const h3Hash = await question("Enter H3 hash: ");
    const arweaveHash = await question("Enter Arweave hash: ");

    const messageHash = hre.ethers.solidityPackedKeccak256(
        ["address", "string", "string"],
        [ownerAddress, h3Hash, arweaveHash]
    );

    const signature = await signer.signMessage(hre.ethers.getBytes(messageHash));

    console.log("\n✅ Signature generated!");
    console.log("─".repeat(50));
    console.log("Signature:", signature);
    console.log("─".repeat(50));
    console.log("\nSave this signature and provide it to the owner for minting.");
}

async function mintLand(landRegistry, signer) {
    console.log("\n🏞️  Mint Land NFT");

    const h3Hash = await question("Enter H3 hash: ");
    const arweaveHash = await question("Enter Arweave hash: ");
    const signature = await question("Enter government signature: ");

    try {
        const tx = await landRegistry.mint(h3Hash, arweaveHash, signature);
        console.log("⏳ Transaction sent:", tx.hash);
        const receipt = await tx.wait();

        // Find the LandMinted event
        const event = receipt.logs.find(
            (log) => log.fragment && log.fragment.name === "LandMinted"
        );

        if (event) {
            console.log("\n✅ Land minted successfully!");
            console.log("Token ID:", event.args.tokenId.toString());
            console.log("Owner:", event.args.owner);
            console.log("H3 Hash:", event.args.h3Hash);
        } else {
            console.log("✅ Land minted successfully!");
        }
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

async function listLandForSale(landRegistry) {
    console.log("\n💰 List Land for Sale");

    const tokenId = await question("Enter token ID: ");
    const priceInEth = await question("Enter price in ETH: ");

    try {
        const price = hre.ethers.parseEther(priceInEth);
        const tx = await landRegistry.listLand(tokenId, price);
        console.log("⏳ Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Land listed successfully!");
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

async function viewActiveListings(landRegistry) {
    console.log("\n🏪 Active Listings");
    console.log("─".repeat(80));

    try {
        const activeListings = await landRegistry.getActiveListings();

        if (activeListings.length === 0) {
            console.log("No active listings found.");
            return;
        }

        console.log(`Found ${activeListings.length} active listing(s):\n`);

        for (const tokenId of activeListings) {
            const listing = await landRegistry.getListing(tokenId);
            const h3Hash = await landRegistry.getH3Hash(tokenId);

            console.log(`Token ID: ${tokenId}`);
            console.log(`  H3 Hash: ${h3Hash}`);
            console.log(`  Seller: ${listing.seller}`);
            console.log(`  Price: ${hre.ethers.formatEther(listing.price)} ETH`);
            console.log(`  Status: ${listing.isActive ? "Active" : "Inactive"}`);
            console.log("─".repeat(80));
        }
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

async function buyLand(landRegistry) {
    console.log("\n🛒 Buy Land");

    const tokenId = await question("Enter token ID to buy: ");

    try {
        const listing = await landRegistry.getListing(tokenId);

        if (!listing.isActive) {
            console.log("❌ This land is not listed for sale.");
            return;
        }

        const priceInEth = hre.ethers.formatEther(listing.price);
        console.log("\nListing Details:");
        console.log("Seller:", listing.seller);
        console.log("Price:", priceInEth, "ETH");

        const confirm = await question("\nProceed with purchase? (yes/no): ");

        if (confirm.toLowerCase() !== "yes") {
            console.log("❌ Purchase cancelled.");
            return;
        }

        const tx = await landRegistry.buyLand(tokenId, { value: listing.price });
        console.log("⏳ Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Land purchased successfully!");
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

async function viewMyLands(landRegistry, signer) {
    console.log("\n🏠 My Lands");
    console.log("─".repeat(80));

    try {
        const ownedLands = await landRegistry.getLandsByOwner(signer.address);

        if (ownedLands.length === 0) {
            console.log("You don't own any lands yet.");
            return;
        }

        console.log(`You own ${ownedLands.length} land(s):\n`);

        for (const tokenId of ownedLands) {
            const h3Hash = await landRegistry.getH3Hash(tokenId);
            const tokenURI = await landRegistry.tokenURI(tokenId);
            const listing = await landRegistry.getListing(tokenId);

            console.log(`Token ID: ${tokenId}`);
            console.log(`  H3 Hash: ${h3Hash}`);
            console.log(`  Token URI: ${tokenURI}`);
            console.log(`  Listed: ${listing.isActive ? `Yes (${hre.ethers.formatEther(listing.price)} ETH)` : "No"}`);
            console.log("─".repeat(80));
        }
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    rl.close();
    process.exit(1);
});
