import { expect } from "chai";
import { BigNumber } from "ethers";
import { Signers, MainnetSigner } from "../types";

export function shouldMigrateFromSmartPool(): void {
  it("should migrate smart pool funds to liquidity migration contract", async function () {
    const pool = await this.pools[0].contract;
    // const controller = await (new MainnetSigner(pool.controller)).impersonateAccount();
    // const adminBalance = await pool.balanceOf(this.signers.admin.getAddress());
    // expect(await pool.isPublicSwap()).to.eq(true);
    // expect(adminBalance).to.eq(BigNumber.from(0));

    // TODO: joinPool not found ??
    // const tx = await pool.connect(this.signers.admin).joinPool(100);
  });
}
