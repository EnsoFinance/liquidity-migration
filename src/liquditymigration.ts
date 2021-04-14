const hre = require("hardhat");
const { ethers, waffle } = hre;
import * as constants from "./constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deploy } from "@bodhi/contracts/";
import { LiquidityMigration__factory, LiquidityMigration } from "../typechain";

export enum AcceptedProtocols {
  Indexed,
  DefiPulseIndex,
  PieDao,
}

export const PROTOCOL_FACTORIES = [constants.FACTORY_REGISTRIES.PIE_DAO_SMART_POOLS];
export const ACCEPTED_PROTOCOLS = [AcceptedProtocols.PieDao] as AcceptedProtocols[];

export class LiquidityMigrationBuilder {
  signer: SignerWithAddress;
  contract?: LiquidityMigration;
  constructor(signer: SignerWithAddress) {
    this.signer = signer;
  }

  async mainnet() {
    const LiquidityMigrationFactory = (await waffle.getContractFactory(
      "LiquidityMigration",
    )) as LiquidityMigration__factory;
    // todo: get enso env
    // this.contract = await LiquidityMigrationFactory.connect(this.signer).deploy();
  }
}
