const hre = require("hardhat");
import * as constants from "./constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, constants as ethConstants, Contract, Signer } from "ethers";
import { IUniswapFactory__factory, IWETH__factory } from "../typechain";
import { Networks } from "./utils";
// import { deployPlatform, deployGenericRouter, deployTokens, deployUniswap, deployBalancer, deployBalancerAdapter, deployUniswapAdapter, deployLoopRouter, Platform } from "@bodhi/contracts"
import { deploy, encode } from "@bodhi/contracts"

export const WETH_SUPPLY = (numTokens: number) => ethConstants.WeiPerEther.mul(100 * (numTokens - 1));

export type Defaults = {
  threshold: number;
  slippage: number;
  timelock: number;
  numTokens: number;
  wethSupply: BigNumber;
};

export class Router {
  type: Routers;
  contract?: Contract;
  constructor(r: string) {
    switch (r.toLowerCase()) {
      case "generic" || "genericrouter":
        this.type = Routers.Generic;
        break;
      case "loop" || "looprouter":
        this.type = Routers.Loop;
        break;
      default:
        throw Error(
          "failed to parse router type: ensobuilder.withrouter() accepted input: generic/loop or genericrouter/looprouter",
        );
    }
  }

  async deploy(signer: SignerWithAddress, controller: Contract, weth: Contract, adapter?: Contract) {
    if (this.type == Routers.Generic) {
      this.contract = await deploy.deployGenericRouter(signer, controller, weth);
    } else {
      if (adapter === undefined) return Error("Didn't pass adapter to Router.deploy()");
      this.contract = await deploy.deployLoopRouter(signer, controller, adapter, weth);
    }
  }
}

export enum Routers {
  Generic,
  Loop,
}

export class EnsoBuilder {
  signer: SignerWithAddress;
  defaults?: Defaults;
  network?: Networks;
  routers?: Router[];
  constructor(signer: SignerWithAddress) {
    this.signer = signer;
  }
  mainnet() {
    this.network = Networks.Mainnet;
    return this;
  }
  testnet() {
    this.network = Networks.LocalTestnet;
    return this;
  }
  getDefaults() {
    return {
      threshold: 10,
      slippage: 995,
      timelock: 60,
      numTokens: 15,
      wethSupply: WETH_SUPPLY(15),
    } as Defaults;
  }
  addRouter(type: string) {
    this.routers?.push(new Router(type));
    return this;
  }
  // Check desired network and deploy/connect uniswap/balancer/whitelist/etc. (defaults to mainnet)
  async build(): Promise<EnsoEnvironment> {
    this.defaults = this.defaults == undefined ? this.getDefaults() : this.defaults;
    let tokens = [] as Contract[];
    let uniswap = {} as Contract;
    switch (this.network) {
      case Networks.LocalTestnet:
        tokens = await deploy.deployTokens(this.signer, this.defaults.numTokens, this.defaults.wethSupply);
        uniswap = await deploy.deployUniswap(this.signer, tokens);
      case Networks.Mainnet:
        tokens = [IWETH__factory.connect(constants.WETH, this.signer) as Contract];
        uniswap = IUniswapFactory__factory.connect(constants.FACTORY_REGISTRIES.UNISWAP, this.signer) as Contract;
      default:
        tokens = [IWETH__factory.connect(constants.WETH, this.signer) as Contract];
        uniswap = IUniswapFactory__factory.connect(constants.FACTORY_REGISTRIES.UNISWAP, this.signer) as Contract;
    }
    const ensoPlatform = await deploy.deployPlatform(
      this.signer,
      uniswap,
      new Contract(constants.WETH, tokens[0].abi, this.signer),
    );
    // TODO: adapter
    if (this.routers === undefined) {
      this.addRouter("generic");
      this.addRouter("loop");
    } else {
      // this.routers.forEach(async (r) => {
      // await r.deploy(signer, controller, tokens[0], this.adapter)
      // })
    }
    // TODO: whitelisting
    return new EnsoEnvironment(this.signer, this.defaults, ensoPlatform, uniswap, tokens);
  }
}

export class EnsoEnvironment {
  signer: SignerWithAddress;
  defaults: {};
  enso: deploy.Platform;
  uniswap: Contract;
  tokens: Contract[];
  balancer?: Contract;

  constructor(
    signer: SignerWithAddress,
    defaults: Defaults,
    enso: deploy.Platform,
    uniswap: Contract,
    tokens: Contract[],
    balancer?: Contract,
  ) {
    this.signer = signer;
    this.defaults = defaults;
    this.enso = enso;
    this.uniswap = uniswap;
    this.tokens = tokens;
    this.balancer = balancer;
  }
}
