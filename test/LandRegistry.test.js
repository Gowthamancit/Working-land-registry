const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LandRegistry", function () {
    let landRegistry;
    let government;
    let owner;
    let surveyor;
    let user1;
    let user2;

    const SAMPLE_H3_HASH = "8928308280fffff";
    const SAMPLE_ARWEAVE_HASH = "arweave://abc123def456";

    beforeEach(async function () {
        [owner, government, surveyor, user1, user2] = await ethers.getSigners();

        const LandRegistry = await ethers.getContractFactory("LandRegistry");
        landRegistry = await LandRegistry.deploy(government.address);
        await landRegistry.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the correct government address", async function () {
            expect(await landRegistry.governmentAddress()).to.equal(government.address);
        });

        it("Should set the correct owner", async function () {
            expect(await landRegistry.owner()).to.equal(owner.address);
        });

        it("Should have correct name and symbol", async function () {
            expect(await landRegistry.name()).to.equal("LandRegistry");
            expect(await landRegistry.symbol()).to.equal("LAND");
        });
    });

    describe("Surveyor Management", function () {
        it("Should allow owner to whitelist surveyor", async function () {
            await landRegistry.whitelistSurveyor(surveyor.address);
            expect(await landRegistry.whitelistedSurveyors(surveyor.address)).to.be.true;
        });

        it("Should allow owner to remove surveyor", async function () {
            await landRegistry.whitelistSurveyor(surveyor.address);
            await landRegistry.removeSurveyor(surveyor.address);
            expect(await landRegistry.whitelistedSurveyors(surveyor.address)).to.be.false;
        });

        it("Should allow batch whitelisting", async function () {
            await landRegistry.batchWhitelistSurveyors([surveyor.address, user1.address]);
            expect(await landRegistry.whitelistedSurveyors(surveyor.address)).to.be.true;
            expect(await landRegistry.whitelistedSurveyors(user1.address)).to.be.true;
        });

        it("Should emit SurveyorWhitelisted event", async function () {
            await expect(landRegistry.whitelistSurveyor(surveyor.address))
                .to.emit(landRegistry, "SurveyorWhitelisted")
                .withArgs(surveyor.address);
        });
    });

    describe("Government Signature Verification (The Judge)", function () {
        it("Should mint land with valid government signature", async function () {
            // Create the message hash
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "string", "string"],
                [user1.address, SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH]
            );

            // Sign with government account
            const signature = await government.signMessage(ethers.getBytes(messageHash));

            // Mint the land
            await expect(
                landRegistry.connect(user1).mint(SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH, signature)
            )
                .to.emit(landRegistry, "LandMinted")
                .withArgs(1, user1.address, SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH);

            // Verify the mint
            expect(await landRegistry.ownerOf(1)).to.equal(user1.address);
            expect(await landRegistry.isMinted(SAMPLE_H3_HASH)).to.be.true;
            expect(await landRegistry.tokenIdToH3Hash(1)).to.equal(SAMPLE_H3_HASH);
        });

        it("Should reject mint with invalid signature", async function () {
            // Create the message hash
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "string", "string"],
                [user1.address, SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH]
            );

            // Sign with wrong account (not government)
            const signature = await user2.signMessage(ethers.getBytes(messageHash));

            // Try to mint - should fail
            await expect(
                landRegistry.connect(user1).mint(SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH, signature)
            ).to.be.revertedWithCustomError(landRegistry, "InvalidSignature");
        });

        it("Should reject minting already minted land", async function () {
            // First mint
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "string", "string"],
                [user1.address, SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH]
            );
            const signature = await government.signMessage(ethers.getBytes(messageHash));
            await landRegistry.connect(user1).mint(SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH, signature);

            // Try to mint again - should fail
            await expect(
                landRegistry.connect(user1).mint(SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH, signature)
            ).to.be.revertedWithCustomError(landRegistry, "LandAlreadyMinted");
        });
    });

    describe("Marketplace - Listing", function () {
        let tokenId;

        beforeEach(async function () {
            // Mint a land first
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "string", "string"],
                [user1.address, SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH]
            );
            const signature = await government.signMessage(ethers.getBytes(messageHash));
            await landRegistry.connect(user1).mint(SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH, signature);
            tokenId = 1;
        });

        it("Should allow owner to list land for sale", async function () {
            const price = ethers.parseEther("1.0");

            await expect(landRegistry.connect(user1).listLand(tokenId, price))
                .to.emit(landRegistry, "LandListed")
                .withArgs(tokenId, user1.address, price);

            const listing = await landRegistry.getListing(tokenId);
            expect(listing.isActive).to.be.true;
            expect(listing.price).to.equal(price);
            expect(listing.seller).to.equal(user1.address);
        });

        it("Should reject listing by non-owner", async function () {
            const price = ethers.parseEther("1.0");
            await expect(
                landRegistry.connect(user2).listLand(tokenId, price)
            ).to.be.revertedWithCustomError(landRegistry, "NotLandOwner");
        });

        it("Should reject listing with zero price", async function () {
            await expect(
                landRegistry.connect(user1).listLand(tokenId, 0)
            ).to.be.revertedWithCustomError(landRegistry, "InvalidPrice");
        });

        it("Should allow owner to unlist land", async function () {
            const price = ethers.parseEther("1.0");
            await landRegistry.connect(user1).listLand(tokenId, price);

            await expect(landRegistry.connect(user1).unlistLand(tokenId))
                .to.emit(landRegistry, "LandUnlisted")
                .withArgs(tokenId);

            const listing = await landRegistry.getListing(tokenId);
            expect(listing.isActive).to.be.false;
        });
    });

    describe("Marketplace - Buying", function () {
        let tokenId;
        const listingPrice = ethers.parseEther("1.0");

        beforeEach(async function () {
            // Mint and list a land
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "string", "string"],
                [user1.address, SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH]
            );
            const signature = await government.signMessage(ethers.getBytes(messageHash));
            await landRegistry.connect(user1).mint(SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH, signature);
            tokenId = 1;
            await landRegistry.connect(user1).listLand(tokenId, listingPrice);
        });

        it("Should allow buying listed land with correct payment", async function () {
            const initialBalance = await ethers.provider.getBalance(user1.address);

            await expect(
                landRegistry.connect(user2).buyLand(tokenId, { value: listingPrice })
            )
                .to.emit(landRegistry, "LandSold")
                .withArgs(tokenId, user1.address, user2.address, listingPrice);

            // Verify NFT transfer
            expect(await landRegistry.ownerOf(tokenId)).to.equal(user2.address);

            // Verify listing is inactive
            const listing = await landRegistry.getListing(tokenId);
            expect(listing.isActive).to.be.false;

            // Verify seller received payment
            const finalBalance = await ethers.provider.getBalance(user1.address);
            expect(finalBalance).to.be.gt(initialBalance);
        });

        it("Should reject buying with insufficient payment", async function () {
            const insufficientPayment = ethers.parseEther("0.5");
            await expect(
                landRegistry.connect(user2).buyLand(tokenId, { value: insufficientPayment })
            ).to.be.revertedWithCustomError(landRegistry, "InsufficientPayment");
        });

        it("Should refund excess payment", async function () {
            const excessPayment = ethers.parseEther("2.0");
            const initialBalance = await ethers.provider.getBalance(user2.address);

            const tx = await landRegistry.connect(user2).buyLand(tokenId, { value: excessPayment });
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            const finalBalance = await ethers.provider.getBalance(user2.address);
            const expectedBalance = initialBalance - listingPrice - gasUsed;

            // Allow for small rounding errors
            expect(finalBalance).to.be.closeTo(expectedBalance, ethers.parseEther("0.001"));
        });

        it("Should reject buying unlisted land", async function () {
            await landRegistry.connect(user1).unlistLand(tokenId);
            await expect(
                landRegistry.connect(user2).buyLand(tokenId, { value: listingPrice })
            ).to.be.revertedWithCustomError(landRegistry, "LandNotListed");
        });
    });

    describe("View Functions", function () {
        it("Should return correct total supply", async function () {
            expect(await landRegistry.totalSupply()).to.equal(0);

            // Mint a land
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "string", "string"],
                [user1.address, SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH]
            );
            const signature = await government.signMessage(ethers.getBytes(messageHash));
            await landRegistry.connect(user1).mint(SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH, signature);

            expect(await landRegistry.totalSupply()).to.equal(1);
        });

        it("Should return lands owned by address", async function () {
            // Mint two lands for user1
            const messageHash1 = ethers.solidityPackedKeccak256(
                ["address", "string", "string"],
                [user1.address, SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH]
            );
            const signature1 = await government.signMessage(ethers.getBytes(messageHash1));
            await landRegistry.connect(user1).mint(SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH, signature1);

            const h3Hash2 = "8928308280ffffe";
            const messageHash2 = ethers.solidityPackedKeccak256(
                ["address", "string", "string"],
                [user1.address, h3Hash2, SAMPLE_ARWEAVE_HASH]
            );
            const signature2 = await government.signMessage(ethers.getBytes(messageHash2));
            await landRegistry.connect(user1).mint(h3Hash2, SAMPLE_ARWEAVE_HASH, signature2);

            const ownedLands = await landRegistry.getLandsByOwner(user1.address);
            expect(ownedLands.length).to.equal(2);
            expect(ownedLands[0]).to.equal(1);
            expect(ownedLands[1]).to.equal(2);
        });

        it("Should return active listings", async function () {
            // Mint and list two lands
            const messageHash = ethers.solidityPackedKeccak256(
                ["address", "string", "string"],
                [user1.address, SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH]
            );
            const signature = await government.signMessage(ethers.getBytes(messageHash));
            await landRegistry.connect(user1).mint(SAMPLE_H3_HASH, SAMPLE_ARWEAVE_HASH, signature);
            await landRegistry.connect(user1).listLand(1, ethers.parseEther("1.0"));

            const activeListings = await landRegistry.getActiveListings();
            expect(activeListings.length).to.equal(1);
            expect(activeListings[0]).to.equal(1);
        });
    });
});
