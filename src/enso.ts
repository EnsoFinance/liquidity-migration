const hre = require("hardhat");
import * as constants from "./constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deploy } from "@bodhi/contracts/";
import { BigNumber, constants as ethConstants, Contract } from "ethers";
import { Builder } from "builder-pattern";

export class Options {
  threshold: number;
  slippage: number;
  numTokens: number;
  timelock: number;
  wethSupply: BigNumber;
  builder() {
    return Builder<this>();
  }
  default(): Options {
    return this.builder()
      .threshold(10)
      .slippage(995)
      .numTokens(15)
      .timelock(60)
      .wethSupply(WETH_SUPPLY(15))
      .build();
  }
}

export const WETH_SUPPLY = (numTokens: number) => ethConstants.WeiPerEther.mul(100 * (numTokens - 1));

export class EnsoEnvironmentBuilder {
  signer: SignerWithAddress;
  options: Options;
  enso?: deploy.Platform;
  uniswap?: Contract;
  tokens?: Contract[];
  balancer?: Contract;

  constructor(signer: SignerWithAddress) {
    this.signer = signer;
    this.options = new Options().default();
  }

  async buildLocal(options?: Options) {
    this.tokens = await deploy.deployTokens(this.signer, this.options.numTokens, this.options.wethSupply);
    this.uniswap = await deploy.deployUniswap(this.signer, this.tokens);
    this.enso = await deploy.deployPlatform(
      this.signer,
      this.uniswap,
      new Contract(constants.WETH, this.tokens[0].abi, this.signer),
    );
  }

  async buildMainnet(options?: Options) {
    // TODO: get tokens
    // this.enso = await deploy.deployPlatform(this.signer, this.uniswap, new Contract(constants.WETH, this.tokens[0].abi, this.signer));
  }
}
