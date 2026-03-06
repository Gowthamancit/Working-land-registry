const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const contractAddress = "0x49B70ff62359959b4Db0B37AABf8883F8969A7ca";

    // Whitelist the deployer as a surveyor for testing
    const surveyorToWhitelist = deployer.address;

    console.log("Whitelisting surveyor:", surveyorToWhitelist);
    console.log("On contract:", contractAddress);

    const LandRegistry = await hre.ethers.getContractAt("LandRegistry", contractAddress);

    const tx = await LandRegistry.whitelistSurveyor(surveyorToWhitelist);
    await tx.wait();

    console.log("✅ Surveyor whitelisted successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
