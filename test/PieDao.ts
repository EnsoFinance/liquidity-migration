import { SmartPoolRegistry, PCappedSmartPool } from "./../typechain/";
import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Signers } from "../types";
import { shouldMigrateFromSmartPool } from "./PieDao.behavior";
import {PIE_DAO_REGISTRY} from "../src/constants";
const { Contract } = hre.ethers;
const { deployContract } = hre.waffle;


describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    this.signers.admin = signers[0];
  });

  describe("PoolRegistry", function () {
    beforeEach(async function () {
      const smartPoolRegistryArtifact: Artifact = await hre.artifacts.readArtifact(
        "SmartPoolRegistry",
      );
      // Smart pool
      const smartPoolArtifact: Artifact = await hre.artifacts.readArtifact(
        "PCappedSmartPool"
      )
      this.smartPoolRegistry = (new Contract(PIE_DAO_REGISTRY, smartPoolRegistryArtifact.abi, this.signers.admin)) as SmartPoolRegistry;
      console.log("PieDaoRegistry: ", this.smartPoolRegistry.address);
      // for (let i = 0; i < 1; i++) {
      //   console.log(await this.smartPoolRegistry.connect(this.signers.admin).owner());
      //   const smartPoolAddress = await this.smartPoolRegistry.entries(i);
      //   console.log("Pool ", i, ": ", smartPoolAddress);
      // }
      // TODO: duplicate types
      // this.smartPoolRegistry = SmartPoolRegistry__factory.connect(PIE_DAO_REGISTRY, this.signers.admin);
    });

    shouldMigrateFromSmartPool()
  });
});
