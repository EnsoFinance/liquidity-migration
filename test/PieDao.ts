import { ethers, waffle } from "hardhat";
import hre from "hardhat";
import {
  SmartPoolRegistry,
  SmartPoolRegistry__factory,
  PCappedSmartPool__factory,
  PCappedSmartPool,
} from "../typechain";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Signers, MainnetSigner } from "../types";
import { shouldMigrateFromSmartPool } from "./PieDao.behavior";
import { PIE_DAO_REGISTRY } from "../src/constants";
import { expect } from "chai";
import { Signer } from "ethers";
import { defaultSigner } from './helpers/utils';


class PieDaoPool {
  address: string;
  contract?: PCappedSmartPool;
  tokens?: string[];
  constructor(address: string) {
    this.address = address;
  }

  async connnect(account: Signer): Promise<PCappedSmartPool> {
    this.contract = (await PCappedSmartPool__factory.connect(this.address, account)) as PCappedSmartPool;
    return this.contract;
  }

  async getTokens() {
    this.contract = this.contract == undefined ? await this.connnect(await defaultSigner()) : this.contract;
    this.tokens = await this.contract.getTokens();
  }
}

describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;

    this.smartPoolRegistry = (await SmartPoolRegistry__factory.connect(
      PIE_DAO_REGISTRY,
      this.signers.admin,
    )) as SmartPoolRegistry;
    console.log("PieDaoRegistry: ", this.smartPoolRegistry.address);

    const pieDaoAdmin = await this.smartPoolRegistry.connect(await defaultSigner()).owner();
    this.signers.admin = await new MainnetSigner(pieDaoAdmin).impersonateAccount();

    this.pools = [];
    let noPool = false;
    let poolIndex = 0;
    while (!noPool) {
      try {
        const poolAddr = await this.smartPoolRegistry.entries(poolIndex);
        this.pools.push(await new PieDaoPool(poolAddr).getTokens());
        poolIndex++;
      } catch (err) {
        expect(err == "Error: Transaction reverted without a reason");
        noPool = true;
      }
    }
    const registeredPools = Promise.all(
      this.pools.map(
        async (p: PieDaoPool) => await this.smartPoolRegistry.connect(this.signers.admin).inRegistry(p.address),
      ),
    );
    (await registeredPools).map(p => expect(p).to.eq(true));
  });

  describe("PoolRegistry", function () {
    beforeEach(async function () {
      // const etherscanAbi = await ethers.getVerifiedContractAt(PIE_DAO_REGISTRY);
    });

    shouldMigrateFromSmartPool();
  });
});
