import { Signer } from "ethers";
import { waffle } from "hardhat";
import hre from "hardhat";

export interface Signers {
  admin: Signer;
  default: Signer;
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

export class EnsoPlatformBuilder{
  signer: Signer;
  constructor(signer: Signer) {
    this.signer = signer;
  }

 async build() {
  }
}

