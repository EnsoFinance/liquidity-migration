import { ethers } from "hardhat";
import { MainnetSigner } from "../types";
import { Contract, Signer } from "ethers";
import { FACTORY_REGISTRIES, POWERPOOL_HOLDERS, WETH } from "./constants";
import { BalancerAdapter__factory, IBalancerPool__factory, IBalancerPool } from "../typechain";

export class PowerpoolEnvironmentBuilder {
  signer: Signer;

  constructor(signer: Signer) {
    this.signer = signer;
  }
  async connect(): Promise<PowerpoolEnvironment> {
    const powerIndexPool = (await IBalancerPool__factory.connect(
      FACTORY_REGISTRIES.POWER,
      this.signer,
    )) as IBalancerPool;

    const BalancerAdapterFactory = (await ethers.getContractFactory("BalancerAdapter")) as BalancerAdapter__factory;

    const signerAddress = await this.signer.getAddress();

    // deploying the DPI Adapter
    const adapter = await BalancerAdapterFactory.deploy(signerAddress);

    const addresses = POWERPOOL_HOLDERS[FACTORY_REGISTRIES.POWER];
    if (addresses === undefined) {
      throw Error(`Failed to find token holder for contract: ${FACTORY_REGISTRIES.POWER} `);
    }

    const signers = [];
    for (let i = 0; i < addresses.length; i++) {
      const signer = await new MainnetSigner(addresses[i]).impersonateAccount();
      signers.push(signer);
    }

    return new PowerpoolEnvironment(this.signer, powerIndexPool, adapter, signers);
  }
}

export class PowerpoolEnvironment {
  signer: Signer;
  powerIndexPool: Contract;
  adapter: Contract;
  holders: Signer[];
  constructor(signer: Signer, powerIndexPool: Contract, adapter: Contract, holders: Signer[]) {
    this.signer = signer;
    this.powerIndexPool = powerIndexPool;
    this.adapter = adapter;
    this.holders = holders;
  }
}
