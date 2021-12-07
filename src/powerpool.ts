import { ethers } from "hardhat";
import { MainnetSigner } from "../types";
import { Contract, Signer } from "ethers";
import { FACTORY_REGISTRIES, POWERPOOL_HOLDERS } from "./constants";
import { BalancerAdapter__factory, IBalancerPool__factory, IBalancerPool } from "../typechain";

export class PowerpoolEnvironmentBuilder {
  signer: Signer;
  adapter?: Contract;

  constructor(signer: Signer, adapter?: Contract) {
    this.signer = signer;
    this.adapter = adapter;
  }
  async connect(pool?: string, holders?: string[]): Promise<PowerpoolEnvironment> {
    const lp = pool ?? FACTORY_REGISTRIES.POWER;
    const powerIndexPool = ( IBalancerPool__factory.connect(lp, this.signer)) as IBalancerPool;
    const BalancerAdapterFactory = (await ethers.getContractFactory("BalancerAdapter")) as BalancerAdapter__factory;
    const signerAddress = await this.signer.getAddress();
    const adapter = this.adapter?? await BalancerAdapterFactory.deploy(signerAddress);
    const addresses = holders?? POWERPOOL_HOLDERS[FACTORY_REGISTRIES.POWER];
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
