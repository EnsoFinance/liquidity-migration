import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Event } from "ethers";
import { ERC20__factory } from "../typechain";

//TODO: dipesh to check the @enso/contracts
import { StrategyBuilder, Multicall, encodeSettleTransfer } from "@enso/contracts"
import { AcceptedProtocols } from "../src/liquiditymigration"

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

export function shouldStakeLPToken(): void {
  it("Token holder should be able to stake LP token", async function () {
    const pool = this.pieDaoEnv.pools[0];
    const contract = await pool.contract;
    const holder = pool.holders[0];
    const holderAddress = await holder.getAddress()

    const holderBalance = await contract.balanceOf(holderAddress);
    expect(holderBalance).to.be.gt(BigNumber.from(0));
    await contract.connect(holder).approve(this.liquidityMigration.address, holderBalance)
    await this.liquidityMigration.connect(holder).stakeLpTokens(contract.address, holderBalance, AcceptedProtocols.PieDao)
    expect((await this.liquidityMigration.stakes(holderAddress, contract.address))[0]).to.equal(holderBalance)
  })
}

export function shouldMigrateToStrategy(): void {
  it("Should migrate tokens to strategy", async function () {
    const pool = this.pieDaoEnv.pools[0];
    const poolContract = await pool.contract;
    const routerContract = this.ensoEnv.routers[0].contract

    const holder = pool.holders[0];
    const holderAddress = await holder.getAddress()
    const amount = (await this.liquidityMigration.stakes(holderAddress, poolContract.address))[0]

    // Setup migration calls using PieDaoAdapter contract
    const adapterData = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [poolContract.address, amount])
    const migrationCalls: Multicall[] = await this.pieDaoEnv.adapter.encodeExecute(adapterData)
    // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[]
    for (let i = 0; i < pool.tokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, pool.tokens[i], this.strategy.address))
    }
    // Encode multicalls for GenericRouter
    const calls: Multicall[] = [...migrationCalls, ...transferCalls]
    const migrationData = await routerContract.encodeCalls(calls)
    // Migrate
    await this.liquidityMigration.connect(holder).migrate(
      this.strategy.address,
      poolContract.address,
      AcceptedProtocols.PieDao,
      migrationData,
      0
    )
    const [total, ] = await this.ensoEnv.enso.oracle.estimateTotal(this.strategy.address, pool.tokens)
    expect(total).to.gt(0)
    expect(await this.strategy.balanceOf(holderAddress)).to.gt(0)
  })
}
