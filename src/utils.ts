import { BigNumber } from "ethers";
import { ethers } from "hardhat";


export enum Networks {
  Mainnet,
  LocalTestnet,
  ExternalTestnet,
}

export async function getBlockTime(timeInSeconds: number): Promise<BigNumber> {
  const blockNumber = await ethers.provider.send('eth_blockNumber', [])
  const block = await ethers.provider.send('eth_getBlockByNumber', [blockNumber, true])
  return BigNumber.from(block.timestamp).add(timeInSeconds)
}
