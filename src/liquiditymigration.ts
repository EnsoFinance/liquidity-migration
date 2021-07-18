import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IAdapter, LiquidityMigration__factory } from "../typechain";
import { EnsoEnvironment } from "@enso/contracts";
import { getBlockTime } from './utils'

export enum AcceptedProtocols {
  Indexed,
  TokenSets,
  PieDao,
}

export type Adapter = {
  protocol: AcceptedProtocols;
  adapter: string;
};

export class LiquidityMigrationBuilder {
  signer: SignerWithAddress;
  adapters: Adapter[];
  liquidityMigration?: Contract;
  ensoEnv: EnsoEnvironment;

  constructor(signer: SignerWithAddress, enso: EnsoEnvironment) {
    this.signer = signer;
    this.ensoEnv = enso;
    this.adapters = [] as Adapter[];
  }

  addAdapter(protocol: AcceptedProtocols, adapter: IAdapter) {
    this.adapters.push({
      protocol,
      adapter: adapter.address,
    });
  }

  async deploy() {
    if (this.adapters.length === 0) throw new Error("No adapters set!");

    const LiquidityMigrationFactory = (await ethers.getContractFactory(
      "LiquidityMigration",
    )) as LiquidityMigration__factory;

    const unlock = await getBlockTime(5);

    if (this.ensoEnv.routers[0].contract) {
      this.liquidityMigration = await LiquidityMigrationFactory.connect(this.signer).deploy(
        this.adapters.map(a => a.adapter),
        this.ensoEnv.routers[0].contract.address,
        this.ensoEnv.enso.strategyFactory.address,
        this.ensoEnv.enso.controller.address,
        unlock,
        ethers.constants.MaxUint256,
        this.signer.address
      );
      return this.liquidityMigration;
    } else {
      return undefined;
    }
  }
}
