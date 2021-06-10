import { ethers } from "hardhat";
import { BigNumber, Contract, Event } from "ethers";
import { Signers, MainnetSigner } from "../types";
import { IStrategy__factory } from "../typechain";
import { shouldStakeLPToken, shouldMigrateToStrategy } from "./PieDao.behavior";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration"
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { StrategyBuilder, Position } from "@enso/contracts"
import { DIVISOR, THRESHOLD, TIMELOCK, SLIPPAGE } from "../src/constants"