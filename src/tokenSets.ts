import { ethers } from "hardhat";
import { MainnetSigner } from "../types";
import { Contract, Signer } from "ethers";
import { EnsoEnvironment } from "@enso/contracts";

import { TOKENSET_HOLDERS, WETH } from "./constants";
import {
  SetToken__factory,
  SetToken,
  IBasicIssuanceModule__factory,
  IBasicIssuanceModule,
  INAVIssuanceModule__factory,
  INAVIssuanceModule,
  TokenSetAdapter__factory,
} from "../typechain";

export class TokenSetEnvironmentBuilder {
  signer: Signer;
  enso: EnsoEnvironment;

  constructor(signer: Signer, enso: EnsoEnvironment) {
    this.signer = signer;
    this.enso = enso;
  }
  async connect(tokenSetsBasicIssuanceModule: string, tokenSetsNAVIssuanceModule: string, tokenSetPoolAddress: string): Promise<TokenSetEnvironment> {
    const setBasicIssuanceModule = (await IBasicIssuanceModule__factory.connect(
      tokenSetsBasicIssuanceModule,
      this.signer,
    )) as IBasicIssuanceModule;

    const setNAVIssuanceModule = (await INAVIssuanceModule__factory.connect(
      tokenSetsNAVIssuanceModule,
      this.signer,
    )) as INAVIssuanceModule;

    const tokenSet = (await SetToken__factory.connect(tokenSetPoolAddress, this.signer)) as SetToken;

    const tokenSetAdapterFactory = (await ethers.getContractFactory("TokenSetAdapter")) as TokenSetAdapter__factory;

    const signerAddress = await this.signer.getAddress();

    const generiRouter: string = this.enso?.routers[0]?.contract?.address || ethers.constants.AddressZero
    // deploying the DPI Adapter
    const adapter = await tokenSetAdapterFactory.deploy(setBasicIssuanceModule.address, setNAVIssuanceModule.address, WETH, generiRouter, signerAddress);

    const addresses = TOKENSET_HOLDERS[tokenSetPoolAddress];
    if (addresses === undefined) {
      throw Error(`Failed to find token holder for contract: ${tokenSetPoolAddress} `);
    }

    const signers = [];
    for (let i = 0; i < addresses.length; i++) {
      const signer = await new MainnetSigner(addresses[i]).impersonateAccount();
      signers.push(signer);
    }

    return new TokenSetEnvironment(this.signer, setBasicIssuanceModule, setNAVIssuanceModule, tokenSet, adapter, signers);
  }
}

export class TokenSetEnvironment {
  signer: Signer;
  setBasicIssuanceModule: Contract;
  setNAVIssuanceModule: Contract;
  tokenSet: Contract;
  adapter: Contract;
  holders: Signer[];
  constructor(
    signer: Signer,
    setBasicIssuanceModule: Contract,
    setNAVIssuanceModule: Contract,
    tokenSet: Contract,
    adapter: Contract,
    holders: Signer[],
  ) {
    this.signer = signer;
    this.setBasicIssuanceModule = setBasicIssuanceModule;
    this.setNAVIssuanceModule = setNAVIssuanceModule;
    this.tokenSet = tokenSet;
    this.adapter = adapter;
    this.holders = holders;
  }
}
