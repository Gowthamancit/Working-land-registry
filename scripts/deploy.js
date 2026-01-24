const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying LandRegistry Contract...\n");

    // Get the government address from environment variable or use deployer
    const [deployer] = await hre.ethers.getSigners();
    const governmentAddress = process.env.GOVERNMENT_ADDRESS || deployer.address;

    console.log("Deploying with account:", deployer.address);
    console.log("Government address:", governmentAddress);
    console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
    console.log("");

    // Deploy the contract
    const LandRegistry = await hre.ethers.getContractFactory("LandRegistry");
    const landRegistry = await LandRegistry.deploy(governmentAddress);

    await landRegistry.waitForDeployment();

    const contractAddress = await landRegistry.getAddress();

    console.log("✅ LandRegistry deployed to:", contractAddress);
    console.log("");
    console.log("📋 Contract Details:");
    console.log("   - Name:", await landRegistry.name());
    console.log("   - Symbol:", await landRegistry.symbol());
    console.log("   - Government Address:", await landRegistry.governmentAddress());
    console.log("   - Owner:", await landRegistry.owner());
    console.log("");

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        contractAddress: contractAddress,
        governmentAddress: governmentAddress,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber(),
    };

    const fs = require("fs");
    const deploymentPath = `./deployments/${hre.network.name}.json`;

    // Create deployments directory if it doesn't exist
    if (!fs.existsSync("./deployments")) {
        fs.mkdirSync("./deployments");
    }

    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("📄 Deployment info saved to:", deploymentPath);
    console.log("");

    // Wait for a few block confirmations before verifying
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("⏳ Waiting for block confirmations...");
        await landRegistry.deploymentTransaction().wait(6);

        console.log("🔍 Verifying contract on Etherscan...");
        try {
            await hre.run("verify:verify", {
                address: contractAddress,
                constructorArguments: [governmentAddress],
            });
            console.log("✅ Contract verified on Etherscan");
        } catch (error) {
            console.log("❌ Error verifying contract:", error.message);
        }
    }

    console.log("");
    console.log("🎉 Deployment Complete!");
    console.log("");
    console.log("Next steps:");
    console.log("1. Update your frontend with the contract address:", contractAddress);
    console.log("2. Whitelist surveyors using: landRegistry.whitelistSurveyor(address)");
    console.log("3. Government can now sign land minting approvals");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
