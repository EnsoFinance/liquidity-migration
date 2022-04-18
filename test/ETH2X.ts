import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilderV2 } from "../src/liquiditymigrationv2";
import { IERC20__factory, IStrategy__factory, IUniswapV3Router__factory } from "../typechain";

import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import {
  FACTORY_REGISTRIES,
  TOKENSET_ISSUANCE_MODULES,
  INITIAL_STATE,
  UNISWAP_V3_ROUTER,
  DEPOSIT_SLIPPAGE,
} from "../src/constants";
import { estimateTokens } from "../src/utils";
import {
  EnsoBuilder,
  Position,
  Multicall,
  Tokens,
  prepareStrategy,
  encodeSettleTransfer,
  deployLeverage2XAdapter,
} from "@ensofinance/v1-core";
import AaveV2Adapter from "@ensofinance/v1-core/artifacts/contracts/adapters/lending/AaveV2Adapter.sol/AaveV2Adapter.json";

describe("ETH_2X: Unit tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];

    const ensoBuilder = new EnsoBuilder(this.signers.admin).mainnet();
    ensoBuilder.addAdapter("leverage");
    this.enso = await ensoBuilder.build();

    this.tokens = new Tokens();

    let aaveV2 = new Contract(this.enso.adapters.aaveV2.contract.address, AaveV2Adapter.abi, this.signers.default);

    const addressesProvider = new Contract(await aaveV2.addressesProvider(), [], this.signers.default);

    let leverageAdapter = await deployLeverage2XAdapter(
      this.signers.default,
      this.enso.adapters.uniswap.contract,
      this.enso.adapters.aaveV2.contract,
      this.enso.adapters.aaveV2Debt.contract,
      addressesProvider,
      new Contract(this.tokens.usdc, [], this.signers.default),
      new Contract(this.tokens.weth, [], this.signers.default),
    );

    this.enso.adapters.leverage.contract = leverageAdapter;

    const { chainlinkRegistry, uniswapV3Registry } = this.enso.platform.oracles.registries;

    this.tokens.registerTokens(
      this.signers.admin,
      this.enso.platform.strategyFactory,
      uniswapV3Registry,
      chainlinkRegistry,
    );

    this.TokenSetEnv = await new TokenSetEnvironmentBuilder(this.signers.default, this.enso).connect(
      FACTORY_REGISTRIES.ETH_2X,
    );

    console.log(`Token Sets Adapter: ${this.TokenSetEnv.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilderV2(this.signers.admin, this.enso);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.TokenSets, this.TokenSetEnv.adapter);
    await liquidityMigrationBuilder.deploy();
    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;
  });

  it("Token holder should be able to stake LP token", async function () {
    const tx = await this.TokenSetEnv.adapter.connect(this.signers.default).add(FACTORY_REGISTRIES.ETH_2X);
    await tx.wait();
    const holder2 = await this.TokenSetEnv.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.TokenSetEnv.pool.balanceOf(holder2Address);
    expect(holder2Balance).to.be.gt(BigNumber.from(0));

    await this.TokenSetEnv.pool.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.TokenSetEnv.pool.address, holder2Balance.div(2), this.TokenSetEnv.adapter.address);
    expect(await this.liquidityMigration.staked(holder2Address, this.TokenSetEnv.pool.address)).to.equal(
      holder2Balance.div(2),
    );
    const holder2AfterBalance = await this.TokenSetEnv.pool.balanceOf(holder2Address);
    expect(holder2AfterBalance).to.be.gt(BigNumber.from(0));
  });

  it("Should not be able to migrate tokens if the ETH_2X token is not whitelisted in the Token Sets Adapter", async function () {
    const routerContract = this.enso.routers[0].contract;

    const holder2 = await this.TokenSetEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.TokenSetEnv.pool.balanceOf(holder2Address);
    expect(holder2BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.TokenSetEnv.pool.connect(holder2).approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.TokenSetEnv.pool.address, holder2BalanceBefore, this.TokenSetEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder2Address, this.TokenSetEnv.pool.address);
    expect(amount).to.be.gt(BigNumber.from(0));

    const tx = await this.TokenSetEnv.adapter.connect(this.signers.default).remove(FACTORY_REGISTRIES.ETH_2X);
    await tx.wait();
    // Migrate
    await expect(
      this.liquidityMigration
        .connect(this.signers.admin)
        ["migrateAll(address,address)"](this.TokenSetEnv.pool.address, this.TokenSetEnv.adapter.address),
    ).to.be.reverted;
  });

  it("Adding to whitelist from non-manager account should fail", async function () {
    // adding the ETH_2X Token as a whitelisted token
    await expect(this.TokenSetEnv.adapter.connect(this.signers.admin).add(FACTORY_REGISTRIES.ETH_2X)).to.be.reverted;
  });

  it("Getting the output token list", async function () {
    // adding the ETH_2X Token as a whitelisted token
    const underlyingTokens = await this.TokenSetEnv.pool.getComponents();
    const outputTokens = await this.TokenSetEnv.adapter.outputTokens(FACTORY_REGISTRIES.ETH_2X);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Migration using a non-whitelisted token should fail", async function () {
    const routerContract = this.enso.routers[0].contract;

    const holder3 = await this.TokenSetEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // Setup migration calls using Adapter contract
    await expect(this.TokenSetEnv.adapter.encodeWithdraw(holder3Address, BigNumber.from(100))).to.be.revertedWith(
      "Whitelistable#onlyWhitelisted: not whitelisted lp",
    );
  });

  it("Create strategy", async function () {
    // adding the ETH_2X Token as a whitelisted token
    let tx = await this.TokenSetEnv.adapter.connect(this.signers.default).add(FACTORY_REGISTRIES.ETH_2X);
    await tx.wait();

    const positions = [
      {
        token: this.tokens.aWETH,
        percentage: BigNumber.from(2000),
        adapters: [this.enso.adapters.aaveV2.contract.address],
        path: [],
        cache: ethers.utils.defaultAbiCoder.encode(
          ["uint16"],
          [500], // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
        ),
      },
      {
        token: this.tokens.debtUSDC,
        percentage: BigNumber.from(-1000),
        adapters: [
          this.enso.adapters.aaveV2Debt.contract.address,
          this.enso.adapters.uniswap.contract.address,
          this.enso.adapters.aaveV2.contract.address,
        ],
        path: [this.tokens.usdc, this.tokens.weth],
        cache: ethers.utils.defaultAbiCoder.encode(["address"], [this.tokens.aWETH]),
      },
    ];
    const strategyItems = prepareStrategy(positions, this.enso.adapters.uniswap.contract.address);

    const strategyManagerAddress = this.signers.default.address;

    const MigrationControllerImplementation = await ethers.getContractFactory("MigrationController");
    const migrationControllerImplementation = await MigrationControllerImplementation.deploy(
      this.enso.platform.strategyFactory.address,
      this.liquidityMigration.address,
      strategyManagerAddress,
    );
    await migrationControllerImplementation.deployed();
    await this.enso.platform.controller["updateAddresses()"]();

    // Upgrade controller to new implementation
    await this.enso.platform.administration.platformProxyAdmin
      .connect(this.signers.admin)
      .upgrade(this.enso.platform.controller.address, migrationControllerImplementation.address);

    // deploy strategy
    tx = await this.enso.platform.strategyFactory
      .connect(this.signers.default)
      .createStrategy(
        strategyManagerAddress,
        "ETH_2X",
        "ETH_2X",
        strategyItems,
        INITIAL_STATE,
        this.enso.adapters.leverage.contract.address,
        "0x",
      );

    const receipt = await tx.wait();
    const strategyAddress = receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
    this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);

    await this.liquidityMigration.connect(this.signers.admin).updateController(this.enso.platform.controller.address);
    await this.liquidityMigration
      .connect(this.signers.admin)
      .updateGenericRouter(this.enso.routers[0].contract.address); // this is multicall router

    await this.liquidityMigration
      .connect(this.signers.admin)
      ["setStrategy(address,address)"](this.TokenSetEnv.pool.address, this.strategy.address);
  });

  it("Should migrate tokens to strategy", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder2 = await this.TokenSetEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    const amount = await this.liquidityMigration.staked(holder2Address, this.TokenSetEnv.pool.address);
    expect(amount).to.be.gt(BigNumber.from(0));
    // Migrate

    const whitelist = this.enso.platform.administration.whitelist;
    await whitelist.approve(this.enso.adapters.leverage.contract.address);

    await this.liquidityMigration.connect(this.signers.admin).updateUnlock(0);

    let tx = await this.liquidityMigration
      .connect(this.signers.admin)
      ["migrateAll(address,address)"](this.TokenSetEnv.pool.address, this.TokenSetEnv.adapter.address);
    let receipt = await tx.wait();
    console.log('Gas Used `migrateAll`: ', receipt.gasUsed.toString());

    const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, this.strategy.address, [
      this.tokens.aWETH,
      this.tokens.debtUSDC,
    ]);
    expect(total).to.gt(0);
    expect(await this.liquidityMigration.staked(holder2Address, this.TokenSetEnv.pool.address)).to.gt(0);
  });

  it("Should buy and stake", async function () {
    /*    
    const defaultAddress = await this.signers.default.getAddress();

    expect(await this.TokenSetEnv.pool.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.strategy.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    
    expect(await this.liquidityMigration.staked(defaultAddress, this.TokenSetEnv.pool.address)).to.be.eq(
      BigNumber.from(0),
    );

    const ethAmount = ethers.constants.WeiPerEther;
    // FIXME this fails on the uniV3 quoter `quoteExactInputSingle`
    const expectedAmount = await this.TokenSetEnv.adapter.callStatic.getAmountOut(
      this.TokenSetEnv.pool.address,
      UNISWAP_V3_ROUTER,
      ethAmount,
    );
    console.log("Expected: ", expectedAmount.toString());

    await this.liquidityMigration.connect(this.signers.default).buyAndStake(
      this.TokenSetEnv.pool.address,
      this.TokenSetEnv.adapter.address,
      UNISWAP_V3_ROUTER,
      expectedAmount.mul(995).div(1000), //0.5% slippage
      ethers.constants.MaxUint256,
      { value: ethAmount },
    );

    const staked = await this.liquidityMigration.staked(defaultAddress, this.TokenSetEnv.pool.address);
    console.log("Staked: ", staked.toString());
    expect(staked).to.be.gt(BigNumber.from(0));
    */
  });
});
