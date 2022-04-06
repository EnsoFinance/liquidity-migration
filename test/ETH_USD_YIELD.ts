import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20, IERC20__factory, IStrategy__factory } from "../typechain";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { DEPOSIT_SLIPPAGE, FACTORY_REGISTRIES, INITIAL_STATE, UNISWAP_V3_ROUTER } from "../src/constants";
import { setupStrategyItems, estimateTokens, encodeStrategyData } from "../src/utils";
import { EnsoBuilder } from "@enso/contracts";

describe("ETH_USD_YIELD: Unit tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];

    this.enso = await new EnsoBuilder(this.signers.admin).mainnet().build();

    this.ETHUSDYieldEnv = await new TokenSetEnvironmentBuilder(this.signers.default, this.enso).connect(
      FACTORY_REGISTRIES.ETH_USD_YIELD,
    );

    console.log(`Token Sets Adapter: ${this.ETHUSDYieldEnv.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.enso);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.TokenSets, this.ETHUSDYieldEnv.adapter);
    await liquidityMigrationBuilder.deploy();
    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;
  });

  it("Token holder should be able to withdraw from pool", async function () {
    // getting holders of ETH_USD_YIELD Tokens

    const holderBalances: any[] = [];
    for (let i = 0; i < this.ETHUSDYieldEnv.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.ETHUSDYieldEnv.holders[i].getAddress(),
        balance: await this.ETHUSDYieldEnv.pool.balanceOf(await this.ETHUSDYieldEnv.holders[i].getAddress()),
      };
      expect(await this.ETHUSDYieldEnv.pool.balanceOf(await this.ETHUSDYieldEnv.holders[i].getAddress())).to.be.gt(
        BigNumber.from(0),
      );
    }

    // getting the underlying tokens
    const underlyingTokens = await this.ETHUSDYieldEnv.pool.getComponents();

    // redeeming the token
    const setBasicIssuanceModule = this.ETHUSDYieldEnv.setBasicIssuanceModule;
    const holder = await this.ETHUSDYieldEnv.holders[0].getAddress();
    const tokenBalance = holderBalances[0].balance;
    const tokenContract = IERC20__factory.connect(underlyingTokens[0], this.ETHUSDYieldEnv.holders[0]) as IERC20;
    const previousUnderlyingTokenBalance = await tokenContract.balanceOf(holder);
    const tx = await setBasicIssuanceModule
      .connect(this.ETHUSDYieldEnv.holders[0])
      .redeem(this.ETHUSDYieldEnv.pool.address, tokenBalance.div(4), holder);
    await tx.wait();
    const updatedBalance = await this.ETHUSDYieldEnv.pool.balanceOf(holder);
    const updatedUnderlyingTokenBalance = await tokenContract.balanceOf(holder);
    expect(updatedBalance.lt(tokenBalance)).to.be.true;
    expect(updatedUnderlyingTokenBalance.gt(previousUnderlyingTokenBalance)).to.be.true;
  });

  it("Token holder should be able to stake LP token", async function () {
    const tx = await this.ETHUSDYieldEnv.adapter.connect(this.signers.default).add(FACTORY_REGISTRIES.ETH_USD_YIELD);
    await tx.wait();
    const holder2 = await this.ETHUSDYieldEnv.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.ETHUSDYieldEnv.pool.balanceOf(holder2Address);
    expect(holder2Balance).to.be.gt(BigNumber.from(0));
    await this.ETHUSDYieldEnv.pool.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.ETHUSDYieldEnv.pool.address, holder2Balance.div(2), this.ETHUSDYieldEnv.adapter.address);
    expect(await this.liquidityMigration.staked(holder2Address, this.ETHUSDYieldEnv.pool.address)).to.equal(
      holder2Balance.div(2),
    );
    const holder2AfterBalance = await this.ETHUSDYieldEnv.pool.balanceOf(holder2Address);
    expect(holder2AfterBalance).to.be.gt(BigNumber.from(0));
  });

  it("Should not be able to migrate tokens if the ETH_USD_YIELD token is not whitelisted in the Token Sets Adapter", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder2 = await this.ETHUSDYieldEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.ETHUSDYieldEnv.pool.balanceOf(holder2Address);
    expect(holder2BalanceBefore).to.be.gt(BigNumber.from(0));
    await this.ETHUSDYieldEnv.pool.connect(holder2).approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.ETHUSDYieldEnv.pool.address, holder2BalanceBefore, this.ETHUSDYieldEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder2Address, this.ETHUSDYieldEnv.pool.address);
    expect(amount).to.be.gt(BigNumber.from(0));

    const tx = await this.ETHUSDYieldEnv.adapter.connect(this.signers.default).remove(FACTORY_REGISTRIES.ETH_USD_YIELD);
    await tx.wait();
    // Migrate
    await expect(
      this.liquidityMigration
        .connect(holder2)
        ["migrate(address,address,address,uint256)"](
          this.ETHUSDYieldEnv.pool.address,
          this.ETHUSDYieldEnv.adapter.address,
          ethers.constants.AddressZero,
          DEPOSIT_SLIPPAGE,
        ),
    ).to.be.reverted;
  });

  it("Adding to whitelist from non-manager account should fail", async function () {
    // adding the ETH_USD_YIELD Token as a whitelisted token
    await expect(this.ETHUSDYieldEnv.adapter.connect(this.signers.admin).add(FACTORY_REGISTRIES.ETH_USD_YIELD)).to.be
      .reverted;
  });

  it("Getting the output token list", async function () {
    // adding the ETH_USD_YIELD Token as a whitelisted token
    const underlyingTokens = await this.ETHUSDYieldEnv.pool.getComponents();
    const outputTokens = await this.ETHUSDYieldEnv.adapter.outputTokens(FACTORY_REGISTRIES.ETH_USD_YIELD);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Migration using a non-whitelisted token should fail", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder3 = await this.ETHUSDYieldEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // Setup migration calls using Adapter contract
    await expect(this.ETHUSDYieldEnv.adapter.encodeWithdraw(holder3Address, BigNumber.from(100))).to.be.revertedWith(
      "Whitelistable#onlyWhitelisted: not whitelisted lp",
    );
  });

  it("Create strategy", async function () {
    // adding the ETH_USD_YIELD Token as a whitelisted token
    let tx = await this.ETHUSDYieldEnv.adapter.connect(this.signers.default).add(FACTORY_REGISTRIES.ETH_USD_YIELD);
    await tx.wait();

    // getting the underlying tokens from ETH_USD_YIELD
    const underlyingTokens = await this.ETHUSDYieldEnv.pool.getComponents();
    // deploy strategy
    const strategyData = encodeStrategyData(
      this.signers.default.address,
      "ETH_USD_YIELD",
      "ETH_USD_YIELD",
      await setupStrategyItems(
        this.enso.platform.oracles.ensoOracle,
        this.enso.adapters.uniswap.contract.address,
        this.ETHUSDYieldEnv.pool.address,
        underlyingTokens,
      ),
      INITIAL_STATE,
      ethers.constants.AddressZero,
      "0x",
    );
    tx = await this.liquidityMigration.createStrategy(
      this.ETHUSDYieldEnv.pool.address,
      this.ETHUSDYieldEnv.adapter.address,
      strategyData,
    );
    const receipt = await tx.wait();
    const strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
    console.log("Strategy address: ", strategyAddress);
    this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  });

  it("Should migrate tokens to strategy", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder3 = await this.ETHUSDYieldEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // staking the tokens in the liquidity migration contract
    const holder3BalanceBefore = await this.ETHUSDYieldEnv.pool.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.ETHUSDYieldEnv.pool.connect(holder3).approve(this.liquidityMigration.address, holder3BalanceBefore);
    await this.liquidityMigration
      .connect(holder3)
      .stake(this.ETHUSDYieldEnv.pool.address, holder3BalanceBefore, this.ETHUSDYieldEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder3Address, this.ETHUSDYieldEnv.pool.address);
    expect(amount).to.be.gt(BigNumber.from(0));
    const holder3BalanceAfter = await this.ETHUSDYieldEnv.pool.balanceOf(holder3Address);
    expect(holder3BalanceAfter).to.be.equal(BigNumber.from(0));
    // Migrate
    await this.liquidityMigration
      .connect(holder3)
      ["migrate(address,address,address,uint256)"](
        this.ETHUSDYieldEnv.pool.address,
        this.ETHUSDYieldEnv.adapter.address,
        this.strategy.address,
        DEPOSIT_SLIPPAGE,
      );
    const [total] = await estimateTokens(
      this.enso.platform.oracles.ensoOracle,
      this.strategy.address,
      await this.ETHUSDYieldEnv.pool.getComponents(),
    );
    expect(total).to.be.gt(0);
    expect(await this.strategy.balanceOf(holder3Address)).to.be.gt(0);
  });

  it("Should fail to buy and stake: token not on exchange", async function () {
    await expect(
      this.liquidityMigration
        .connect(this.signers.default)
        .buyAndStake(
          this.ETHUSDYieldEnv.pool.address,
          this.ETHUSDYieldEnv.adapter.address,
          UNISWAP_V3_ROUTER,
          0,
          ethers.constants.MaxUint256,
          { value: ethers.constants.WeiPerEther },
        ),
    ).to.be.reverted;
  });
});
