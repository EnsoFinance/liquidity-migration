import { ethers } from "hardhat";
import { expect } from "chai";
import { MainnetSigner } from "../types";
import { PIE_DAO_HOLDERS } from "../src/constants";
import { BigNumber, Contract, Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { StrategyBuilder, Strategy, Implementation } from "./strategy";

import { FACTORY_REGISTRIES } from "../src/constants";
import {
  ERC20,
  ERC20__factory,
  PieDaoAdapter__factory,
  SmartPoolRegistry,
  SmartPoolRegistry__factory,
  IPV2SmartPool,
  IPV2SmartPool__factory,
  PCappedSmartPool,
  PCappedSmartPool__factory,
  IBasketFacet,
  IBasketFacet__factory,
  IProxy,
  IProxy__factory,
} from "../typechain";

export class PieDaoEnvironmentBuilder {
  signer: SignerWithAddress;

  constructor(signer: SignerWithAddress) {
    this.signer = signer;
  }
  async connect(pool?: string, holders?: string[]): Promise<PieDaoEnvironment> {
    const lp = pool ?? "0x0327112423F3A68efdF1fcF402F6c5CB9f7C33fd";

    const lpHolders = holders ?? PIE_DAO_HOLDERS[lp];

    if (!lpHolders) throw Error("No holders of provided pool: " + lp);

    const pieDaoSigners = await Promise.all(lpHolders.map(async h => await new MainnetSigner(h).impersonateAccount()));

    const PieDaoAdapterFactory = (await ethers.getContractFactory("PieDaoAdapter")) as PieDaoAdapter__factory;

    const adapter = await PieDaoAdapterFactory.deploy(this.signer.address);

    const contract = await this.getImplementation(lp);

    return new PieDaoEnvironment(this.signer, contract, adapter, pieDaoSigners);
  }

  async getImplementation(proxyAddress: string): Promise<Contract> {
    const proxy = IProxy__factory.connect(proxyAddress, this.signer) as IProxy;
    const implementation = await proxy.connect(this.signer).getImplementation();
    switch (implementation) {
      case "0x706F00ea85a71EB5d7C2ce2aD61DbBE62b616435":
        return IPV2SmartPool__factory.connect(proxyAddress, this.signer) as IPV2SmartPool;

      case "0xf13f977AaC9B001f155889b9EFa7A6628Fb7a181":
        return PCappedSmartPool__factory.connect(proxyAddress, this.signer) as PCappedSmartPool;

      case "0x1f863776975A69b6078FdAfAb6298d3E823E0190":
        return IBasketFacet__factory.connect(proxyAddress, this.signer) as IBasketFacet;

      default:
        throw Error("No matching implementation for piedao");
    }
  }
}

export class PieDaoEnvironment {
  signer: SignerWithAddress;
  pool: Contract;
  adapter: Contract;
  holders: Signer[];
  constructor(signer: SignerWithAddress, pool: Contract, adapter: Contract, holders: Signer[]) {
    this.signer = signer;
    this.pool = pool;
    this.adapter = adapter;
    this.holders = holders;
  }
}
