import { ethers } from "hardhat";
import { MainnetSigner } from "../types";
import { Contract, Signer } from "ethers";

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

  constructor(signer: Signer) {
    this.signer = signer;
  }
  async connect(tokenSetsIssuanceModule: string, tokenSetPoolAddress: string): Promise<TokenSetEnvironment> {
    const setBasicIssuanceModule = (await BasicIssuanceModule__factory.connect(
      tokenSetsIssuanceModule,
      this.signer,
    )) as BasicIssuanceModule;

    const tokenSet = (await SetToken__factory.connect(tokenSetPoolAddress, this.signer)) as SetToken;

    const tokenSetAdapterFactory = (await ethers.getContractFactory("TokenSetAdapter")) as TokenSetAdapter__factory;

    const signerAddress = await this.signer.getAddress();

    // deploying the DPI Adapter
    const adapter = await tokenSetAdapterFactory.deploy(setBasicIssuanceModule.address, signerAddress);

    const addresses = TOKENSET_HOLDERS[tokenSetPoolAddress];
    if (addresses === undefined) {
      throw Error(`Failed to find token holder for contract: ${tokenSetPoolAddress} `);
    }

    const signers = [];
    for (let i = 0; i < addresses.length; i++) {
      const signer = await new MainnetSigner(addresses[i]).impersonateAccount();
      signers.push(signer);
    }

    return new TokenSetEnvironment(this.signer, setBasicIssuanceModule, tokenSet, adapter, signers);
  }
}

export class TokenSetEnvironment {
  signer: Signer;
  setBasicIssuanceModule: Contract;
  tokenSet: Contract;
  adapter: Contract;
  holders: Signer[];
  constructor(
    signer: Signer,
    setBasicIssuanceModule: Contract,
    tokenSet: Contract,
    adapter: Contract,
    holders: Signer[],
  ) {
    this.signer = signer;
    this.setBasicIssuanceModule = setBasicIssuanceModule;
    this.tokenSet = tokenSet;
    this.adapter = adapter;
    this.holders = holders;
  }
}
