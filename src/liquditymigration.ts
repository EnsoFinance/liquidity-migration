const hre = require("hardhat");
const { waffle } = hre;
import * as constants from "./constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {  LiquidityMigration, LiquidityMigration__factory} from "../typechain";
import { EnsoBuilder, EnsoEnvironment } from '@bodhi/contracts'

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
    const ensoEnv = await new EnsoBuilder(this.signer).testnet().addRouter('generic').build();
    console.log(ensoEnv)
    const LiquidityMigrationFactory = (await waffle.getContractFactory(
      "LiquidityMigration",
    )) as LiquidityMigration__factory;
    // const tx = await LiquidityMigrationFactory.deploy(
    //   ACCEPTED_PROTOCOLS,
    //   PROTOCOL_FACTORIES,
    //   ensoEnv.routers.generic,
    // );

    // todo: get enso env
    // this.contract = await LiquidityMigrationFactory.connect(this.signer).deploy();
  }
}
