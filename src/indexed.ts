import { ethers } from "hardhat";
import { MainnetSigner } from "../types";
import { Contract, Signer } from "ethers";

import { FACTORY_REGISTRIES, INDEXED_HOLDERS, WETH } from "./constants";
import { IndexedAdapter__factory, ISigmaIndexPoolV1__factory, ISigmaIndexPoolV1 } from "../typechain";

export class IndexedEnvironmentBuilder {
  signer: Signer;

  constructor(signer: Signer) {
    this.signer = signer;
  }
  async connect(): Promise<IndexedEnvironment> {
    const degenIndexPool = (await ISigmaIndexPoolV1__factory.connect(
      FACTORY_REGISTRIES.DEGEN_INDEX,
      this.signer,
    )) as ISigmaIndexPoolV1;

    const IndexedAdapterFactory = (await ethers.getContractFactory("IndexedAdapter")) as IndexedAdapter__factory;

    const signerAddress = await this.signer.getAddress();

    // deploying the DPI Adapter
    const adapter = await IndexedAdapterFactory.deploy(signerAddress, WETH);

    const addresses = INDEXED_HOLDERS[FACTORY_REGISTRIES.DEGEN_INDEX];
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
  degenIndexPool: Contract;
  adapter: Contract;
  holders: Signer[];
  constructor(signer: Signer, degenIndexPool: Contract, adapter: Contract, holders: Signer[]) {
    this.signer = signer;
    this.degenIndexPool = degenIndexPool;
    this.adapter = adapter;
    this.holders = holders;
  }
}
