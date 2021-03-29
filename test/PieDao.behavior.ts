import { expect } from "chai";
import { BigNumber } from "ethers";
import { Signers, MainnetSigner } from "../types";

export function shouldMigrateFromSmartPool(): void {
  it("should migrate smart pool funds to liquidity migration contract", async function () {
    const pool = await this.pools[0].contract;
    const adminBalance = await pool.balanceOf(this.signers.admin.getAddress());
    expect(adminBalance).to.eq(BigNumber.from(0));

    await expect(pool.connect(this.signers.admin).joinPool(100)).to.be.revertedWith("revert ERC777: transfer amount exceeds balance");
  });
}
