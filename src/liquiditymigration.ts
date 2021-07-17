import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IAdapter, LiquidityMigration, LiquidityMigration__factory } from "../typechain";
import { EnsoBuilder, EnsoEnvironment } from "@enso/contracts";
import { getBlockTime } from './utils'

export enum AcceptedProtocols {
  Indexed,
  DefiPulseIndex,
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
  enso?: EnsoEnvironment;

  constructor(signer: SignerWithAddress) {
    this.signer = signer;
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
    this.enso = await new EnsoBuilder(this.signer).mainnet().build();

    const LiquidityMigrationFactory = (await ethers.getContractFactory(
      "LiquidityMigration",
    )) as LiquidityMigration__factory;

    const now = await getBlockTime();

    if (this.enso.routers[0].contract) {
      this.liquidityMigration = await LiquidityMigrationFactory.connect(this.signer).deploy(
        this.adapters.map(a => a.adapter),
        this.enso.routers[0].contract.address,
        this.enso.enso.strategyFactory.address,
        this.enso.enso.controller.address,
        now,
        ethers.constants.MaxUint256,
        this.signer.address
      );
      return this.liquidityMigration;
    } else {
      return undefined;
    }
  }
}
