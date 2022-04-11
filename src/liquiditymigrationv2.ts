import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IAdapter, LiquidityMigration__factory, LiquidityMigrationV2__factory } from "../typechain";
import { EnsoEnvironment } from "@ensofinance/v1-core";
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

  async deploy(): Promise<LiquidityMigrationV2> {
    if (this.adapters.length === 0) throw new Error("No adapters set!");

    const LiquidityMigrationFactory = (await ethers.getContractFactory(
      "LiquidityMigrationV2",
    )) as LiquidityMigrationV2__factory;

    const unlock = await getBlockTime(100);

    this.liquidityMigration = await LiquidityMigrationFactory.connect(this.signer).deploy(
      this.adapters.map(a => a.adapter),
      unlock,
      ethers.constants.MaxUint256,
    );

    if (!this.liquidityMigration) throw Error("Failed to deploy");

    return new LiquidityMigrationV2(this.signer, this.adapters, this.liquidityMigration, this.enso);
  }
}
export class LiquidityMigrationV2 {
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
