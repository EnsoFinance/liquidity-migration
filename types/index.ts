// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Signer } from "ethers";
import { ethers, waffle } from "hardhat";
import hre from "hardhat";

export interface Signers {
  admin: Signer;
  impersonateAccount(account: string): Promise<Signer>;
}

export class MainnetSigner {
  address: string;
  constructor(address: string) {
    this.address = address;
  }

  async impersonateAccount(): Promise<Signer> {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [this.address],
    });
    return waffle.provider.getSigner(this.address);
  }
}
