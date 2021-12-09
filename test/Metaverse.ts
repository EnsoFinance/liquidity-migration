import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20, IERC20__factory, IStrategy__factory, IUniswapV3Router__factory } from "../typechain";

import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { FACTORY_REGISTRIES, TOKENSET_ISSUANCE_MODULES, WETH, DIVISOR, INITIAL_STATE, UNISWAP_V3_ROUTER, DEPOSIT_SLIPPAGE } from "../src/constants";
import { setupStrategyItems, estimateTokens, encodeStrategyData, increaseTime } from "../src/utils"
import { EnsoBuilder, Position, Multicall, prepareStrategy, encodeSettleTransfer } from "@enso/contracts";



describe("METAVERSE: Unit tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;

    const signers = await ethers.getSigners();

    this.signers.default = signers[0];

    this.signers.admin = signers[10];

    this.enso = await new EnsoBuilder(this.signers.admin).mainnet().build();

    this.metaverse = await new TokenSetEnvironmentBuilder(this.signers.default, this.enso).connect(
      FACTORY_REGISTRIES.METAVERSE,
    );

    console.log(`Token Sets Adapter: ${this.metaverse.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.enso);

    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.TokenSets, this.metaverse.adapter);

    await liquidityMigrationBuilder.deploy();

    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;
  });

  it("Token holder should be able to withdraw from pool", async function () {
    // getting holders of METAVERSE Tokens

    const holderBalances: any[] = [];
    for (let i = 0; i < this.metaverse.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.metaverse.holders[i].getAddress(),
        balance: await this.metaverse.pool.balanceOf(await this.metaverse.holders[i].getAddress()),
      };
      expect(await this.metaverse.pool.balanceOf(await this.metaverse.holders[i].getAddress())).to.be.gt(BigNumber.from(0), "Holder: " + holderBalances[i].holder);
    }

    // getting the underlying tokens
    const underlyingTokens = await this.metaverse.pool.getComponents();

    // redeeming the token
    const setBasicIssuanceModule = this.metaverse.setBasicIssuanceModule;
    const addressWhoIsRedeeming = await this.metaverse.holders[0].getAddress();
    const tokenBalance = holderBalances[0].balance;
    const tokenContract = IERC20__factory.connect(underlyingTokens[0], this.metaverse.holders[0]) as IERC20;
    const previousUnderlyingTokenBalance = await tokenContract.balanceOf(addressWhoIsRedeeming);
    const tx = await setBasicIssuanceModule
      .connect(this.metaverse.holders[0])
      .redeem(this.metaverse.pool.address, tokenBalance, addressWhoIsRedeeming);
    await tx.wait();
    const updatedBalance = await this.metaverse.pool.balanceOf(addressWhoIsRedeeming);
    const updatedUnderlyingTokenBalance = await tokenContract.balanceOf(addressWhoIsRedeeming);
    expect(updatedBalance).to.equal(BigNumber.from(0));
    expect(updatedUnderlyingTokenBalance.gt(previousUnderlyingTokenBalance)).to.be.true;
  });

  it("Token holder should be able to stake LP token", async function () {
    const tx = await this.metaverse.adapter
      .connect(this.signers.default)
      .add(FACTORY_REGISTRIES.METAVERSE);
    await tx.wait();
    const holder2 = await this.metaverse.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.metaverse.pool.balanceOf(holder2Address);
    expect(holder2Balance).to.be.gt(BigNumber.from(0));
    await this.metaverse.pool.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.metaverse.pool.address, holder2Balance.div(2), this.metaverse.adapter.address);
    expect(await this.liquidityMigration.staked(holder2Address, this.metaverse.pool.address)).to.equal(
      holder2Balance.div(2),
    );
    const holder2AfterBalance = await this.metaverse.pool.balanceOf(holder2Address);
    expect(holder2AfterBalance).to.be.gt(BigNumber.from(0));
  });

  it("Should not be able to migrate tokens if the METAVERSE token is not whitelisted in the Token Sets Adapter", async function () {
    await increaseTime(10)
    const holder2 = await this.metaverse.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.metaverse.pool.balanceOf(holder2Address);
    expect(holder2BalanceBefore).to.be.gt(BigNumber.from(0));
    await this.metaverse.pool.connect(holder2).approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.metaverse.pool.address, holder2BalanceBefore, this.metaverse.adapter.address);
    const amount = await this.liquidityMigration.staked(holder2Address, this.metaverse.pool.address);
    expect(amount).to.be.gt(BigNumber.from(0));

    const tx = await this.metaverse.adapter
      .connect(this.signers.default)
      .remove(FACTORY_REGISTRIES.METAVERSE);
    await tx.wait();
    // Migrate
    await expect(
      this.liquidityMigration
        .connect(holder2)
        ['migrate(address,address,address,uint256)'](
          this.metaverse.pool.address,
          this.metaverse.adapter.address,
          ethers.constants.AddressZero,
          DEPOSIT_SLIPPAGE
        ),
    ).to.be.reverted;
  });

  it("Adding to whitelist from non-manager account should fail", async function () {
    // adding the METAVERSE Token as a whitelisted token
    await expect(
      this.metaverse.adapter.connect(this.signers.admin).add(FACTORY_REGISTRIES.METAVERSE)
    ).to.be.reverted;
  });

  it("Getting the output token list", async function () {
    // adding the METAVERSE Token as a whitelisted token
    const underlyingTokens = await this.metaverse.pool.getComponents();
    const outputTokens = await this.metaverse.adapter.outputTokens(FACTORY_REGISTRIES.METAVERSE);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Migration using a non-whitelisted token should fail", async function () {
    const holder3 = await this.metaverse.holders[2];
    const holder3Address = await holder3.getAddress();

    // Setup migration calls using Adapter contract
    await expect(this.metaverse.adapter.encodeWithdraw(holder3Address, BigNumber.from(100))).to.be.revertedWith("Whitelistable#onlyWhitelisted: not whitelisted lp");
  });

  it("Create strategy", async function () {
      // adding the METAVERSE Token as a whitelisted token
      let tx = await this.metaverse.adapter
        .connect(this.signers.default)
        .add(FACTORY_REGISTRIES.METAVERSE);
      await tx.wait();

      // getting the underlying tokens from METAVERSE
      const underlyingTokens = await this.metaverse.pool.getComponents();
      // deploy strategy
      const strategyData = encodeStrategyData(
        this.signers.default.address,
        "METAVERSE",
        "METAVERSE",
        await setupStrategyItems(this.enso.platform.oracles.ensoOracle, this.enso.adapters.uniswap.contract.address, this.metaverse.pool.address, underlyingTokens),
        INITIAL_STATE,
        ethers.constants.AddressZero,
        '0x'
      )
      tx = await this.liquidityMigration.createStrategy(
        this.metaverse.pool.address,
        this.metaverse.adapter.address,
        strategyData
      );
      const receipt = await tx.wait();
      const strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
      console.log("Strategy address: ", strategyAddress);
      this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  })

  it("Should migrate tokens to strategy", async function () {
    const holder3 = await this.metaverse.holders[2];
    const holder3Address = await holder3.getAddress();

    // staking the tokens in the liquidity migration contract
    const holder3BalanceBefore = await this.metaverse.pool.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.metaverse.pool.connect(holder3).approve(this.liquidityMigration.address, holder3BalanceBefore);
    await this.liquidityMigration
      .connect(holder3)
      .stake(this.metaverse.pool.address, holder3BalanceBefore, this.metaverse.adapter.address);
    const amount = await this.liquidityMigration.staked(holder3Address, this.metaverse.pool.address);
    expect(amount).to.be.gt(BigNumber.from(0));
    const holder3BalanceAfter = await this.metaverse.pool.balanceOf(holder3Address);
    expect(holder3BalanceAfter).to.be.equal(BigNumber.from(0));
    // Migrate
    await this.liquidityMigration
      .connect(holder3)
      ['migrate(address,address,address,uint256)'](
        this.metaverse.pool.address,
        this.metaverse.adapter.address,
        this.strategy.address,
        DEPOSIT_SLIPPAGE
      );
    const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, this.strategy.address, await this.metaverse.pool.getComponents());
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holder3Address)).to.gt(0);
  });

  it("Should buy and stake", async function () {
    await this.liquidityMigration.connect(this.signers.default).buyAndStake(
      this.metaverse.pool.address,
      this.metaverse.adapter.address,
      UNISWAP_V3_ROUTER,
      0,
      ethers.constants.MaxUint256,
      {value: ethers.constants.WeiPerEther}
    )
  })

});
