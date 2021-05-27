import { expect } from "chai";
import { BigNumber } from "ethers";
import { ERC20__factory } from "../typechain";

export function shouldMigrateFromSmartPool(): void {
  it("Token holder should be able to withdraw from pool", async function () {
    const pool = this.pieDaoEnv.pools[0];
    const contract = await this.pieDaoEnv.pools[0].contract;
    const holder = pool.holders[0];
    const adminBalance = await contract.balanceOf(await this.signers.admin.getAddress());
    expect(adminBalance).to.eq(BigNumber.from(0));

    const holderBalance = await contract.balanceOf(await holder.getAddress());
    expect(holderBalance).to.gt(BigNumber.from(0));

    await expect(contract.connect(this.signers.admin).joinPool(100)).to.be.revertedWith(
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
