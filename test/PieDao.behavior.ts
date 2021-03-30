import { expect } from "chai";
import { BigNumber } from "ethers";
import { ERC20__factory } from "../typechain";

export function shouldMigrateFromSmartPool(): void {
  it("should migrate smart pool funds to liquidity migration contract", async function () {
    const pool = this.pools[0];
    const contract = await this.pools[0].contract;
    const holder = pool.holders[0];
    const adminBalance = await contract.balanceOf(this.signers.admin.getAddress());
    expect(adminBalance).to.eq(BigNumber.from(0));

    const holderBalance = await contract.balanceOf(holder.getAddress());
    expect(holderBalance).to.gt(BigNumber.from(0));

    await expect(contract.connect(this.signers.admin).joinPool(100)).to.be.revertedWith(
      "revert ERC777: transfer amount exceeds balance",
    );

    const tokenBalances = [];
    for (let i = 0; i < pool.tokens.length; i++) {
      const token = ERC20__factory.connect(pool.tokens[i], this.signers.default);
      const balance = await token.balanceOf(holder.getAddress());
      tokenBalances.push(balance);
    }

    const tx = await contract.connect(holder).exitPool(holderBalance);
    const receipt = await tx.wait();
    expect(await contract.balanceOf(holder.getAddress())).to.eq(0);

    for (let i = 0; i < pool.tokens.length; i++) {
      const token = ERC20__factory.connect(pool.tokens[i], this.signers.default);
      const balance = await token.balanceOf(holder.getAddress());
      expect(balance).to.gt(tokenBalances[i]);
    }
  });
}
