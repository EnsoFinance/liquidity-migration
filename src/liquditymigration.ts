const hre = require("hardhat");
const { ethers, waffle } = hre;
import * as constants from "./constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LiquidityMigration__factory, LiquidityMigration } from "../typechain";
import { EnsoBuilder, Routers, Router } from "./enso";
import { Contract } from "@ethersproject/contracts";

export enum AcceptedProtocols {
  Indexed,
  DefiPulseIndex,
  PieDao,
}

export const PROTOCOL_FACTORIES = [constants.FACTORY_REGISTRIES.PIE_DAO_SMART_POOLS];
export const ACCEPTED_PROTOCOLS = [AcceptedProtocols.PieDao] as AcceptedProtocols[];

export class LiquidityMigrationBuilder {
  signer: SignerWithAddress;
  liquidityMigration?: LiquidityMigration;
  constructor(signer: SignerWithAddress) {
    this.signer = signer;
  }

  async mainnet() {
    const ensoEnv = await new EnsoBuilder(this.signer).mainnet().addRouter("generic").build();
    const LiquidityMigrationFactory = (await waffle.getContractFactory(
      "LiquidityMigration",
    )) as LiquidityMigration__factory;
    // this.liquidityMigration = await LiquidityMigrationFactory.deploy(
    //   ACCEPTED_PROTOCOLS,
    //   PROTOCOL_FACTORIES,
    //   ensoEnv.routers,
    // );

    // todo: get enso env
    // this.contract = await LiquidityMigrationFactory.connect(this.signer).deploy();
  }
}
