import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IAdapter, LiquidityMigration, LiquidityMigration__factory } from "../typechain";
import { EnsoEnvironment } from "@enso/contracts";
import { getBlockTime } from './utils'

export enum AcceptedProtocols {
  Indexed,
  DefiPulseIndex,
  PieDao,
  DHedge,
  Powerpool
}

export type Adapter = {
  protocol: AcceptedProtocols;
  adapter: string;
};

export class LiquidityMigrationBuilder {
  signer: SignerWithAddress;
  adapters: Adapter[];
  liquidityMigration?: Contract;
  enso: EnsoEnvironment;

  constructor(signer: SignerWithAddress, enso: EnsoEnvironment) {
    this.signer = signer;
    this.enso = enso;
    this.adapters = [] as Adapter[];
  }

  addAdapters(protocol: AcceptedProtocols[], adapter: IAdapter[]) {
    for (let i = 0; i < protocol.length; i++) {
      this.adapters.push({
        protocol: protocol[i],
        adapter: adapter[i].address
      })
    }
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

    if (this.enso.routers[0].contract) {
      this.liquidityMigration = await LiquidityMigrationFactory.connect(this.signer).deploy(
        this.adapters.map(a => a.adapter),
        this.enso.routers[0].contract.address,
        this.enso.platform.strategyFactory.address,
        this.enso.platform.controller.address,
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
