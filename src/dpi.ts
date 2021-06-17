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
  
    const setBasicIssuanceModule = (await BasicIssuanceModule__factory.connect(FACTORY_REGISTRIES.SET_BASIC_SET_ISSUANCE_MODULE, this.signer)) as BasicIssuanceModule;

    const DPIToken = (await SetToken__factory.connect(FACTORY_REGISTRIES.DPI, this.signer)) as SetToken;

    const DPIAdapterFactory = (await ethers.getContractFactory('DPIAdapter')) as DPIAdapter__factory;

    const signerAddress = await this.signer.getAddress();

    // deploying the DPI Adapter
    const adapter = await DPIAdapterFactory.deploy(setBasicIssuanceModule.address, signerAddress)
    
    return new DPIEnvironment(this.signer, setBasicIssuanceModule, DPIToken, adapter);

  }

  async getHolders(contract: string): Promise<Signer[]> {
    const addresses = DPI_HOLDERS[contract];
    if (addresses === undefined) {
      throw Error(`Failed to find token holder for contract: ${contract} `);
    }
    const signers = [];
    for (let i = 0; i < addresses.length; i++) {
      const signer = await new MainnetSigner(addresses[i]).impersonateAccount();
      signers.push(signer);
    }
    return signers as Signer[];
  }
}

export class DPIEnvironment {
  signer: Signer;
  setBasicIssuanceModule: Contract;
  DPIToken: Contract;
  adapter: Contract;
  constructor(
    signer: Signer,
    setBasicIssuanceModule: Contract,
    DPIToken: Contract,
    adapter: Contract
  ) {
    this.signer = signer;
    this.setBasicIssuanceModule = setBasicIssuanceModule;
    this.DPIToken = DPIToken;
    this.adapter = adapter;
  }
}

// export class PieDaoPool implements Strategy {
//   contract: Implementation;
//   supply: BigNumber;
//   tokens: string[];
//   name: string;
//   holders: Signer[];

//   constructor(contract: Implementation, supply: BigNumber, tokens: string[], name: string, holders: Signer[]) {
//     this.contract = contract;
//     this.supply = supply;
//     this.tokens = tokens;
//     this.name = name;
//     this.holders = holders;
//   }

//   print(implementation?: string) {
//     console.log("SmartPool: ", this.name);
//     console.log("  Address: ", this.contract.address);
//     if (implementation) console.log("  Implementation: ", implementation);
//     console.log("  Supply: ", this.supply?.toString());
//     console.log("  Tokens: ", this.tokens);
//     console.log("");
//   }
// }
