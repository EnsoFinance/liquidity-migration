import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Signer } from 'ethers';

export interface Signers {
  admin: Signer;
}
