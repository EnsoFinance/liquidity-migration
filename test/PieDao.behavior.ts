import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Event } from "ethers";
import { IStrategy__factory, ERC20__factory } from "../typechain";
import { StrategyBuilder, Position } from "@enso/contracts"
import { DIVISOR, THRESHOLD, TIMELOCK, SLIPPAGE } from "../src/constants"

export function shouldMigrateFromSmartPool(): void {
  it("Token holder should be able to withdraw from pool", async function () {
    const pool = this.pieDaoEnv.pools[0];
    const contract = await pool.contract;
    const holder = pool.holders[0];
    const adminBalance = await contract.balanceOf(await this.pieDaoEnv.admin.getAddress());
    expect(adminBalance).to.eq(BigNumber.from(0));

    const holderBalance = await contract.balanceOf(await holder.getAddress());
    expect(holderBalance).to.be.gt(BigNumber.from(0));

    await expect(contract.connect(this.pieDaoEnv.admin).joinPool(100)).to.be.revertedWith(
      "revert ERC777: transfer amount exceeds balance",
    );

    const totalSupply = await contract.totalSupply();

    const tokenBalances = [];
    for (let i = 0; i < pool.tokens.length; i++) {
      const token = ERC20__factory.connect(pool.tokens[i], this.signers.default);
      const balance = await token.balanceOf(await holder.getAddress());
      tokenBalances.push(balance);
    }

    const tx = await contract.connect(holder).exitPool(holderBalance);
    await tx.wait();
    // const receipt = await tx.wait();
    expect(await contract.balanceOf(await holder.getAddress())).to.eq(BigNumber.from(0));

    for (let i = 0; i < pool.tokens.length; i++) {
      const token = ERC20__factory.connect(pool.tokens[i], this.signers.default);
      const balance = await token.balanceOf(await holder.getAddress());
      expect(balance).to.gt(tokenBalances[i]);
    }
    expect(await contract.totalSupply()).to.eq(totalSupply.sub(holderBalance));
  });
}

export function shouldCreateStrategy(): void {
  it("Should create strategy based on pool", async function () {
    const pool = this.pieDaoEnv.pools[0];
    const contract = await pool.contract;
    const vault = await contract.getBPool();

    const positions = [] as Position[]
    for (let i = 0; i < pool.tokens.length; i++) {
      positions.push({
        token: pool.tokens[i],
        percentage: BigNumber.from(DIVISOR).div(pool.tokens.length)
      })
    }
    const s = new StrategyBuilder(positions, this.enso.adapters.uniswap.contract.address)

    const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [s.tokens, s.adapters])
    const tx = await this.enso.enso.strategyFactory.createStrategy(
      this.signers.default.address,
      'PieDao',
      'PIE',
      s.tokens,
      s.percentages,
      false, //Cannot open strategy without first depositing
      0,
      THRESHOLD,
      SLIPPAGE,
      TIMELOCK,
      this.enso.routers[1].contract.address,
      data
    )
    const receipt = await tx.wait()
    const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
    expect(await this.enso.enso.controller.initialized(strategyAddress)).to.equal(true)
  })
}

export function shouldStakeLPToken(): void {
  it("Token holder should be able to stake LP token", async function () {

  })
}
