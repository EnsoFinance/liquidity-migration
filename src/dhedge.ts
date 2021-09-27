import { ethers } from "hardhat";
import { MainnetSigner } from "../types";
import { Contract, Signer } from "ethers";

import { FACTORY_REGISTRIES, DHEDGE_HOLDERS, WETH, SUSD } from "./constants";
import { DHedgeAdapter__factory, IDHedge__factory, IDHedge } from "../typechain";

export class DHedgeEnvironmentBuilder {
  signer: Signer;

  constructor(signer: Signer) {
    this.signer = signer;
  }
  async connect(): Promise<DHedgeEnvironment> {
    const dHedgeTopIndex = (await IDHedge__factory.connect(
      FACTORY_REGISTRIES.DHEDGE_TOP,
      this.signer,
    )) as IDHedge;

    const DHedgeAdapterFactory = (await ethers.getContractFactory("DHedgeAdapter")) as DHedgeAdapter__factory;

    const signerAddress = await this.signer.getAddress();

    // deploying the DPI Adapter
    const adapter = await DHedgeAdapterFactory.deploy(signerAddress, WETH, SUSD);

    const addresses = DHEDGE_HOLDERS[FACTORY_REGISTRIES.DHEDGE_TOP];
    if (addresses === undefined) {
      throw Error(`Failed to find token holder for contract: ${FACTORY_REGISTRIES.DEGEN_INDEX} `);
    }

    const signers = [];
    for (let i = 0; i < addresses.length; i++) {
      const signer = await new MainnetSigner(addresses[i]).impersonateAccount();
      signers.push(signer);
    }

    return new DHedgeEnvironment(this.signer, dHedgeTopIndex, adapter, signers);
  }
}

export class DHedgeEnvironment {
  signer: Signer;
  dHedgeTopIndex: Contract;
  adapter: Contract;
  holders: Signer[];
  constructor(signer: Signer, dHedgeTopIndex: Contract, adapter: Contract, holders: Signer[]) {
    this.signer = signer;
    this.dHedgeTopIndex = dHedgeTopIndex;
    this.adapter = adapter;
    this.holders = holders;
  }
}
