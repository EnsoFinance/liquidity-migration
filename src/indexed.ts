import { ethers } from "hardhat";
import { MainnetSigner } from "../types";
import { Contract, Signer } from "ethers";

import { FACTORY_REGISTRIES, INDEXED_HOLDERS} from "./constants";
import { BalancerAdapter__factory, IBalancerPool__factory, IBalancerPool } from "../typechain";

export class IndexedEnvironmentBuilder {
  signer: Signer;
  adapter?: Contract;

  constructor(signer: Signer, adapter?: Contract) {
    this.signer = signer;
    this.adapter = adapter;
  }

  async connect(pool?: string, holders?: string[]): Promise<IndexedEnvironment> {
    const lp = pool ?? FACTORY_REGISTRIES.DEGEN_INDEX;
    const degenIndexPool = (await IBalancerPool__factory.connect(lp, this.signer)) as IBalancerPool;
    const BalancerAdapterFactory = (await ethers.getContractFactory("BalancerAdapter")) as BalancerAdapter__factory;
    const signerAddress = await this.signer.getAddress();
    const adapter = this.adapter?? await BalancerAdapterFactory.deploy(signerAddress);
    const addresses = holders ?? INDEXED_HOLDERS[FACTORY_REGISTRIES.DEGEN_INDEX];
    if (addresses === undefined) {
      throw Error(`Failed to find token holder for contract: ${FACTORY_REGISTRIES.DEGEN_INDEX} `);
    }
    const signers = [];
    for (let i = 0; i < addresses.length; i++) {
      const signer = await new MainnetSigner(addresses[i]).impersonateAccount();
      signers.push(signer);
    }
    return new IndexedEnvironment(this.signer, degenIndexPool, adapter, signers);
  }
}

export class IndexedEnvironment {
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
