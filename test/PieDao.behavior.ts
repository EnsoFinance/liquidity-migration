import { expect } from "chai";

export function shouldMigrateFromSmartPool(): void {
  it("should migrate smart pool funds to liquidity migration contract", async function () {
    for (let i = 0; i < 3; i++) {
      console.log("Pie Dao Registry Owner: ", await this.smartPoolRegistry.connect(this.signers.admin).owner());
      const smartPoolAddress = await this.smartPoolRegistry.entries(i);
      console.log("Pool ", i, ": ", smartPoolAddress);
    }
  });
}
