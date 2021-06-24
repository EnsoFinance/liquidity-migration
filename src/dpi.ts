import { ethers } from "hardhat";
import { MainnetSigner } from "../types";
import { DPI_HOLDERS } from "./constants";
import { Contract, Signer } from "ethers";

import { FACTORY_REGISTRIES } from "./constants";
import {
  SetToken__factory,
  SetToken,
  BasicIssuanceModule__factory,
  BasicIssuanceModule,
  DPIAdapter__factory,
} from "../typechain";

export class DPIEnvironmentBuilder {
  signer: Signer;

  constructor(signer: Signer) {
    this.signer = signer;
  }
  async connect(): Promise<DPIEnvironment> {
    const setBasicIssuanceModule = (await BasicIssuanceModule__factory.connect(
      FACTORY_REGISTRIES.SET_BASIC_SET_ISSUANCE_MODULE,
      this.signer,
    )) as BasicIssuanceModule;

    const DPIToken = (await SetToken__factory.connect(FACTORY_REGISTRIES.DPI, this.signer)) as SetToken;

    const DPIAdapterFactory = (await ethers.getContractFactory("DPIAdapter")) as DPIAdapter__factory;

    const signerAddress = await this.signer.getAddress();

    // deploying the DPI Adapter
    const adapter = await DPIAdapterFactory.deploy(setBasicIssuanceModule.address, signerAddress);

    // adding the DPI Token as a whitelisted token
    const tx = await adapter.connect(this.signer).addAcceptedTokensToWhitelist(FACTORY_REGISTRIES.DPI);
    await tx.wait();

    const addresses = DPI_HOLDERS[FACTORY_REGISTRIES.DPI];
    if (addresses === undefined) {
      throw Error(`Failed to find token holder for contract: ${FACTORY_REGISTRIES.DPI} `);
    }

    const signers = [];
    for (let i = 0; i < addresses.length; i++) {
      const signer = await new MainnetSigner(addresses[i]).impersonateAccount();
      signers.push(signer);
    }

    return new DPIEnvironment(this.signer, setBasicIssuanceModule, DPIToken, adapter, signers);
  }
}

export class DPIEnvironment {
  signer: Signer;
  setBasicIssuanceModule: Contract;
  DPIToken: Contract;
  adapter: Contract;
  holders: Signer[];
  constructor(
    signer: Signer,
    setBasicIssuanceModule: Contract,
    DPIToken: Contract,
    adapter: Contract,
    holders: Signer[],
  ) {
    this.signer = signer;
    this.setBasicIssuanceModule = setBasicIssuanceModule;
    this.DPIToken = DPIToken;
    this.adapter = adapter;
    this.holders = holders;
  }
}
