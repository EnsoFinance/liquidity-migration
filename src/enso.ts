const hre = require("hardhat");
const { ethers, waffle } = hre;
import * as constants from "./constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deploy } from "@bodhi/contracts/";
import { LiquidityMigration__factory, LiquidityMigration, IWETH } from "../typechain";
import { BigNumber, constants as ethConstants, Contract } from "ethers";

export enum AcceptedProtocols {
  Indexed,
  DefiPulseIndex,
  PieDao,
}
// =====================TODO: Move to Monorepo======================
export type Options = {
  threshold: number;
  slippage: number;
  numTokens: number;
  timelock: number;
  wethSupply: BigNumber;
};

export const WETH_SUPPLY = (numTokens: number) => ethConstants.WeiPerEther.mul(100 * (numTokens - 1));

export const DEFAULT_OPTIONS: Options = {
  threshold: 10, // 10/1000 = 1%
  slippage: 995, // 995/1000 = 99.5
  numTokens: 15, // Number of erc20 tokens in environment + on uniswap
  timelock: 60, // 1 minute
  wethSupply: WETH_SUPPLY(15),
};

export class EnsoEnvironmentBuilder {
  signer: SignerWithAddress;
  enso?: deploy.Platform;
  options?: Options;
  uniswap?: Contract;
  tokens?: Contract[];
  balancer?: Contract;

  constructor(signer: SignerWithAddress) {
    this.signer = signer;
  }
  async devnet(options?: Options) {
    this.options = options === undefined ? DEFAULT_OPTIONS : options;
    this.tokens = await deploy.deployTokens(this.signer, this.options.numTokens, this.options.wethSupply);
    this.uniswap = await deploy.deployUniswap(this.signer, this.tokens);
    this.enso = await deploy.deployPlatform(
      this.signer,
      this.uniswap,
      new Contract(constants.WETH, this.tokens[0].abi, this.signer),
    );
    // TODO:
  }

  async mainnet(options?: Options) {
    this.options = options === undefined ? DEFAULT_OPTIONS : options;

    // this.enso = await deploy.deployPlatform(this.signer, this.uniswap, new Contract(constants.WETH, this.tokens[0].abi, this.signer));
  }
}

