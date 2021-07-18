import { ethers } from "hardhat";
import { MainnetSigner } from "../types";
import { Contract, Signer } from "ethers";
import { EnsoEnvironment } from "@enso/contracts";

import { TOKENSET_HOLDERS } from "./constants";
import {
  SetToken__factory,
  SetToken,
  BasicIssuanceModule__factory,
  BasicIssuanceModule,
  TokenSetAdapter__factory,
} from "../typechain";

export class TokenSetEnvironmentBuilder {
  signer: Signer;
  enso: EnsoEnvironment;

  constructor(signer: Signer, enso: EnsoEnvironment) {
    this.signer = signer;
    this.enso = enso;
  }
  async connect(tokenSetsIssuanceModule: string, tokenSetPoolAddresses: string[]): Promise<TokenSetEnvironment> {
    const setBasicIssuanceModule = (await BasicIssuanceModule__factory.connect(
      tokenSetsIssuanceModule,
      this.signer,
    )) as BasicIssuanceModule;
    
    const tokenSetArray: Contract[]= [];

    for (let i=0; i<tokenSetPoolAddresses.length; i++) {
      tokenSetArray[i] = (await SetToken__factory.connect(tokenSetPoolAddresses[i], this.signer)) as SetToken; 
    }

    const tokenSetAdapterFactory = (await ethers.getContractFactory("TokenSetAdapter")) as TokenSetAdapter__factory;

    const signerAddress = await this.signer.getAddress();

    const generiRouter: string = this.enso?.routers[0]?.contract?.address || ethers.constants.AddressZero
    // deploying the DPI Adapter
    const adapter = await tokenSetAdapterFactory.deploy(setBasicIssuanceModule.address, generiRouter, signerAddress);

    const addressesArray: string[][] = [];
    for (let index = 0; index < tokenSetPoolAddresses.length; index++) {
      const addresses = TOKENSET_HOLDERS[tokenSetPoolAddresses[index]];
      if (addresses === undefined) {
        throw Error(`Failed to find token holder for contract: ${tokenSetPoolAddresses[index]} `);
      }
      addressesArray[index] = addresses;
    }

    const signersArray: Signer[][] = [];
    addressesArray.forEach(async (e) => {
      const signers = [];
      for (let i = 0; i < e.length; i++) {
        const signer = await new MainnetSigner(e[i]).impersonateAccount();
        signers.push(signer);
      }
    });
    
    return new TokenSetEnvironment(this.signer, setBasicIssuanceModule, tokenSetArray, adapter, signersArray);
  }
}

export class TokenSetEnvironment {
  signer: Signer;
  setBasicIssuanceModule: Contract;
  tokenSet: Contract[];
  adapter: Contract;
  holders: Signer[][];
  constructor(
    signer: Signer,
    setBasicIssuanceModule: Contract,
    tokenSet: Contract[],
    adapter: Contract,
    holders: Signer[][],
  ) {
    this.signer = signer;
    this.setBasicIssuanceModule = setBasicIssuanceModule;
    this.tokenSet = tokenSet;
    this.adapter = adapter;
    this.holders = holders;
  }
}
