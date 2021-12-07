import { ethers } from "hardhat";
import { MainnetSigner } from "../types";
import { Contract, Signer } from "ethers";
import { FACTORY_REGISTRIES, DHEDGE_HOLDERS, SUSD } from "./constants";
import { DHedgeAdapter__factory, IDHedge__factory, IDHedge } from "../typechain";

export class DHedgeEnvironmentBuilder {
  signer: Signer;
  adapter?: Contract;

  constructor(signer: Signer, adapter?: Contract) {
    this.signer = signer;
    this.adapter = adapter;
  }
  async connect(pool?: string, holders?: string[]): Promise<DHedgeEnvironment> {
    const lp = pool ?? FACTORY_REGISTRIES.DHEDGE_TOP;
    const dhedgeIndex = IDHedge__factory.connect(lp, this.signer) as IDHedge;
    const DHedgeAdapterFactory = (await ethers.getContractFactory("DHedgeAdapter")) as DHedgeAdapter__factory;
    const signerAddress = await this.signer.getAddress();
    const adapter = this.adapter ?? (await DHedgeAdapterFactory.deploy(signerAddress, SUSD));
    const addresses = holders ?? DHEDGE_HOLDERS[FACTORY_REGISTRIES.DHEDGE_TOP];
    if (addresses === undefined) {
      throw Error(`Failed to find token holder for contract: ${FACTORY_REGISTRIES.DEGEN_INDEX} `);
    }
    const signers = [];
    for (let i = 0; i < addresses.length; i++) {
      const signer = await new MainnetSigner(addresses[i]).impersonateAccount();
      signers.push(signer);
    }
    return new DHedgeEnvironment(this.signer, dhedgeIndex, adapter, signers);
  }
}

export class DHedgeEnvironment {
  signer: Signer;
  pool: Contract;
  adapter: Contract;
  holders: Signer[];
  constructor(signer: Signer, pool: Contract, adapter: Contract, holders: Signer[]) {
    this.signer = signer;
    this.pool = pool;
    this.adapter = adapter;
    this.holders = holders;
  }
}
