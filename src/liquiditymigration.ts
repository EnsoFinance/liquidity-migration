import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IAdapter, LiquidityMigration__factory } from "../typechain";
import { EnsoEnvironment } from "@enso/contracts";
import { getBlockTime } from "./utils";

export enum AcceptedProtocols {
  Indexed,
  PieDao,
  DHedge,
  Powerpool,
  TokenSets,
  IndexCoop,
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
      this.addAdapter(protocol[i], adapter[i]);
    }
    return this;
  }

  addAdapter(protocol: AcceptedProtocols, adapter: IAdapter) {
    const match = this.adapters.filter(a => a.adapter == adapter.address || a.protocol == protocol);
    if (match.length == 0) {
      this.adapters.push({
        protocol: protocol,
        adapter: adapter.address,
      });
    } else {
      console.log("liquidityMigration.ts: Adapter already added: ", protocol);
    }
  }

  async deploy(): Promise<LiquidityMigration> {
    if (this.adapters.length === 0) throw new Error("No adapters set!");

    if (!this.enso.routers[0].contract) throw Error("Enso environment has no routers");

    const LiquidityMigrationFactory = (await ethers.getContractFactory(
      "LiquidityMigration",
    )) as LiquidityMigration__factory;

    const unlock = await getBlockTime(10);

    this.liquidityMigration = await LiquidityMigrationFactory.connect(this.signer).deploy(
      this.adapters.map(a => a.adapter),
      this.enso.routers[0].contract.address,
      this.enso.platform.strategyFactory.address,
      this.enso.platform.controller.address,
      unlock,
      ethers.constants.MaxUint256,
      this.signer.address,
    );

    if (!this.liquidityMigration) throw Error("Failed to deploy");

    return new LiquidityMigration(this.signer, this.adapters, this.liquidityMigration, this.enso);
  }
}
export class LiquidityMigration {
  signer: SignerWithAddress;
  adapters: Adapter[];
  liquidityMigration: Contract;
  enso: EnsoEnvironment;
  constructor(signer: SignerWithAddress, adapters: Adapter[], liquidityMigration: Contract, enso: EnsoEnvironment) {
    this.signer = signer;
    this.adapters = adapters;
    this.liquidityMigration = liquidityMigration;
    this.enso = enso;
  }
}
