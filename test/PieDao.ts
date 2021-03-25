import { ethers, waffle } from "hardhat";
import hre from "hardhat";
import { SmartPoolRegistry, SmartPoolRegistry__factory } from "../typechain";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Signers, MainnetSigner } from "../types";
import { shouldMigrateFromSmartPool } from "./PieDao.behavior";
import { PIE_DAO_REGISTRY } from "../src/constants";
import { expect } from "chai";

describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const localSigners = await ethers.getSigners();

    this.smartPoolRegistry = (await SmartPoolRegistry__factory.connect(
      PIE_DAO_REGISTRY,
      this.signers.admin,
    )) as SmartPoolRegistry;
    console.log("PieDaoRegistry: ", this.smartPoolRegistry.address);

    const pieDaoAdmin = await this.smartPoolRegistry.connect(localSigners[0]).owner();
    this.signers.admin = await new MainnetSigner(pieDaoAdmin).impersonateAccount();

    console.log("admin: ", await this.signers.admin.getAddress());

    this.pools = [];
    let noPool = false;
    let poolIndex = 0;
    while (!noPool) {
      try {
        const poolAddr = await this.smartPoolRegistry.connect(this.signers.admin).entries(poolIndex);
        console.log("Pool: ", poolIndex, " - ", poolAddr);
        this.pools.push(poolAddr);
        poolIndex++;
      } catch (err) {
        expect(err == "Error: Transaction reverted without a reason");
        console.log("No pool at index ", poolIndex);
        noPool = true;
      }
    }
  });

  describe("PoolRegistry", function () {
    beforeEach(async function () {
      // const etherscanAbi = await ethers.getVerifiedContractAt(PIE_DAO_REGISTRY);
    });

    shouldMigrateFromSmartPool();
  });
});
