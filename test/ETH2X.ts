import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20, IERC20__factory, IStrategy__factory, IUniswapV3Router__factory } from "../typechain";

import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { FACTORY_REGISTRIES, TOKENSET_ISSUANCE_MODULES, WETH, DIVISOR, STRATEGY_STATE, UNISWAP_V3_ROUTER } from "../src/constants";
import { setupStrategyItems, estimateTokens, encodeStrategyData } from "../src/utils"
import { EnsoBuilder, Position, Multicall, Tokens, prepareStrategy, encodeSettleTransfer } from "@enso/contracts";

describe("ETH_2X: Unit tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];

    const ensoBuilder = new EnsoBuilder(this.signers.admin).mainnet()
    ensoBuilder.addAdapter('leverage')
    this.enso = await ensoBuilder.build();
    this.tokens = new Tokens()
    this.tokens.registerTokens(this.signers.admin, this.enso.platform.strategyFactory)

    this.TokenSetEnv = await new TokenSetEnvironmentBuilder(this.signers.default, this.enso).connect(
      FACTORY_REGISTRIES.ETH_2X,
    );

    console.log(`Token Sets Adapter: ${this.TokenSetEnv.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.enso);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.DefiPulseIndex, this.TokenSetEnv.adapter);
    const liquitityMigrationDeployed = await liquidityMigrationBuilder.deploy();
    if (liquitityMigrationDeployed != undefined) {
      console.log(`Liquidity Migration: ${liquitityMigrationDeployed.address}`);
    } else {
      console.log(`Liquidity Migration is undefined`);
    }

    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;
  });

  it("Token holder should be able to withdraw from pool", async function () {
    // getting holders of ETH_2X Tokens

    const holderBalances: any[] = [];
    for (let i = 0; i < this.TokenSetEnv.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.TokenSetEnv.holders[i].getAddress(),
        balance: await this.TokenSetEnv.tokenSet.balanceOf(await this.TokenSetEnv.holders[i].getAddress()),
      };
      expect(await this.TokenSetEnv.tokenSet.balanceOf(await this.TokenSetEnv.holders[i].getAddress())).to.gt(BigNumber.from(0));
    }

    // getting the underlying tokens
    const underlyingTokens = await this.TokenSetEnv.tokenSet.getComponents();
    console.log("Underlying: ", underlyingTokens)

    // redeeming the token
    const setDebtIssuanceModule = this.TokenSetEnv.setDebtIssuanceModule;
    const addressWhoIsRedeeming = await this.TokenSetEnv.holders[0].getAddress();
    console.log("Holder: ", addressWhoIsRedeeming)
    const tokenBalance = holderBalances[0].balance;
    console.log("Balance: ", tokenBalance.toString())
    const usdc = IERC20__factory.connect(this.tokens.usdc, this.TokenSetEnv.holders[0]) as IERC20;
    //await usdc.connect(this.TokenSetEnv.holders[0]).approve(setDebtIssuanceModule.address, ethers.constants.MaxUint256)
    const usdcBefore = await usdc.balanceOf(addressWhoIsRedeeming);
    console.log('USDC Before: ', usdcBefore.toString())
    const tx = await setDebtIssuanceModule
      .connect(this.TokenSetEnv.holders[0])
      .redeem(this.TokenSetEnv.tokenSet.address, tokenBalance.div(100), addressWhoIsRedeeming);
    await tx.wait();
    /*
    const updatedBalance = await this.TokenSetEnv.tokenSet.balanceOf(addressWhoIsRedeeming);
    const updatedUnderlyingTokenBalance = await tokenContract.balanceOf(addressWhoIsRedeeming);
    expect(updatedBalance).to.equal(BigNumber.from(0));
    expect(updatedUnderlyingTokenBalance.gt(previousUnderlyingTokenBalance)).to.be.true;
    */
  });

  it("Token holder should be able to stake LP token", async function () {
    const tx = await this.TokenSetEnv.adapter
      .connect(this.signers.default)
      .add(FACTORY_REGISTRIES.ETH_2X);
    await tx.wait();
    const holder2 = await this.TokenSetEnv.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.TokenSetEnv.tokenSet.balanceOf(holder2Address);
    expect(holder2Balance).to.be.gt(BigNumber.from(0));
    await this.TokenSetEnv.tokenSet.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.TokenSetEnv.tokenSet.address, holder2Balance.div(2), this.TokenSetEnv.adapter.address);
    expect(await this.liquidityMigration.staked(holder2Address, this.TokenSetEnv.tokenSet.address)).to.equal(
      holder2Balance.div(2),
    );
    const holder2AfterBalance = await this.TokenSetEnv.tokenSet.balanceOf(holder2Address);
    expect(holder2AfterBalance).to.be.gt(BigNumber.from(0));
  });

  it("Should not be able to migrate tokens if the ETH_2X token is not whitelisted in the Token Sets Adapter", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder2 = await this.TokenSetEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.TokenSetEnv.tokenSet.balanceOf(holder2Address);
    expect(holder2BalanceBefore).to.be.gt(BigNumber.from(0));
    await this.TokenSetEnv.tokenSet.connect(holder2).approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.TokenSetEnv.tokenSet.address, holder2BalanceBefore, this.TokenSetEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder2Address, this.TokenSetEnv.tokenSet.address);
    expect(amount).to.be.gt(BigNumber.from(0));

    // const holder2BalanceAfter = await this.TokenSetEnv.tokenSet.balanceOf(holder2Address);
    // expect(holder2BalanceAfter).to.be.equal(BigNumber.from(0));

    // Setup migration calls using Adapter contract
    const migrationCalls: Multicall[] = await this.TokenSetEnv.adapter.encodeWithdraw(this.TokenSetEnv.tokenSet.address, amount);
    // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    const underlyingTokens = await this.TokenSetEnv.tokenSet.getComponents();
    for (let i = 0; i < underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, underlyingTokens[i], ethers.constants.AddressZero));
    }
    // Encode multicalls for GenericRouter
    const calls: Multicall[] = [...migrationCalls, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    const tx = await this.TokenSetEnv.adapter
      .connect(this.signers.default)
      .remove(FACTORY_REGISTRIES.ETH_2X);
    await tx.wait();
    // Migrate
    await expect(
      this.liquidityMigration
        .connect(holder2)
        ['migrate(address,address,address,bytes)'](
          this.TokenSetEnv.tokenSet.address,
          this.TokenSetEnv.adapter.address,
          ethers.constants.AddressZero,
          migrationData
        ),
    ).to.be.reverted;
  });

  it("Adding to whitelist from non-manager account should fail", async function () {
    // adding the ETH_2X Token as a whitelisted token
    await expect(
      this.TokenSetEnv.adapter.connect(this.signers.admin).add(FACTORY_REGISTRIES.ETH_2X)
    ).to.be.reverted;
  });

  it("Getting the output token list", async function () {
    // adding the ETH_2X Token as a whitelisted token
    const underlyingTokens = await this.TokenSetEnv.tokenSet.getComponents();
    const outputTokens = await this.TokenSetEnv.adapter.outputTokens(FACTORY_REGISTRIES.ETH_2X);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Migration using a non-whitelisted token should fail", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder3 = await this.TokenSetEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // Setup migration calls using Adapter contract
    await expect(this.TokenSetEnv.adapter.encodeWithdraw(holder3Address, BigNumber.from(100))).to.be.revertedWith("Whitelistable#onlyWhitelisted: not whitelisted lp");
  });

  it("Create strategy", async function () {
      // adding the ETH_2X Token as a whitelisted token
      let tx = await this.TokenSetEnv.adapter
        .connect(this.signers.default)
        .add(FACTORY_REGISTRIES.ETH_2X);
      await tx.wait();

      const positions = [
  			{ token: this.tokens.aWETH,
  				percentage: BigNumber.from(2000),
  				adapters: [this.enso.adapters.aavelend.contract.address],
  				path: [],
  				cache: ethers.utils.defaultAbiCoder.encode(
  					['uint16'],
  					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
  				),
  			},
  			{ token: this.tokens.debtUSDC,
  				percentage: BigNumber.from(-1000),
  				adapters: [this.enso.adapters.aaveborrow.contract.address, this.enso.adapters.uniswap.contract.address, this.enso.adapters.aavelend.contract.address],
  				path: [this.tokens.usdc, this.tokens.weth],
  				cache: ethers.utils.defaultAbiCoder.encode(
  					['address'],
  					[this.tokens.aWETH]
  				),
  			}
  		]
  		const strategyItems = prepareStrategy(positions, this.enso.adapters.uniswap.contract.address)

      // deploy strategy
  		tx = await this.enso.platform.strategyFactory
  			.connect(this.signers.default)
  			.createStrategy(
  				this.signers.default.address,
          "ETH_2X",
          "ETH_2X",
  				strategyItems,
          STRATEGY_STATE,
          ethers.constants.AddressZero,
          '0x'
  			)
      const receipt = await tx.wait();
      const strategyAddress = receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
      console.log("Strategy address: ", strategyAddress);
      this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  })

  it("Should migrate tokens to strategy", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder3 = await this.TokenSetEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // staking the tokens in the liquidity migration contract
    const holder3BalanceBefore = await this.TokenSetEnv.tokenSet.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.TokenSetEnv.tokenSet.connect(holder3).approve(this.liquidityMigration.address, holder3BalanceBefore);
    await this.liquidityMigration
      .connect(holder3)
      .stake(this.TokenSetEnv.tokenSet.address, holder3BalanceBefore.div(10), this.TokenSetEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder3Address, this.TokenSetEnv.tokenSet.address);
    expect(amount).to.be.gt(BigNumber.from(0));
    const holder3BalanceAfter = await this.TokenSetEnv.tokenSet.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(holder3BalanceAfter);

    // Migrate
    await this.liquidityMigration
      .connect(holder3)
      .safeMigrate(
        this.TokenSetEnv.tokenSet.address,
        this.TokenSetEnv.adapter.address,
        this.strategy.address
      );
    const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, this.strategy.address, [this.tokens.aWETH, this.tokens.debtUSDC]);
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holder3Address)).to.gt(0);
  });

  it("Should buy and stake", async function () {
    const defaultAddress = await this.signers.default.getAddress();

    expect(await this.TokenSetEnv.tokenSet.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.strategy.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.liquidityMigration.staked(defaultAddress, this.TokenSetEnv.tokenSet.address)).to.be.eq(BigNumber.from(0));

    const ethAmount = ethers.constants.WeiPerEther
    const expectedAmount = await this.TokenSetEnv.adapter.callStatic.getAmountOut(this.TokenSetEnv.tokenSet.address, UNISWAP_V3_ROUTER, ethAmount)
    console.log("Expected: ", expectedAmount.toString())

    await this.liquidityMigration.connect(this.signers.default).buyAndStake(
      this.TokenSetEnv.tokenSet.address,
      this.TokenSetEnv.adapter.address,
      UNISWAP_V3_ROUTER,
      expectedAmount.mul(995).div(1000), //0.5% slippage
      ethers.constants.MaxUint256,
      {value: ethAmount}
    )

    const staked = await this.liquidityMigration.staked(defaultAddress, this.TokenSetEnv.tokenSet.address)
    console.log("Staked: ", staked.toString())
    expect(staked).to.be.gt(BigNumber.from(0));
  })

});
