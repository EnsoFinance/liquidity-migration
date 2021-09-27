import bignumber from "bignumber.js";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { Position, StrategyItem, prepareStrategy } from "@enso/contracts";
import { IERC20__factory } from "../typechain";

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

export async function setupStrategyItems(oracle: Contract, adapter: string, pool: string, underlying: string[]): Promise<StrategyItem[]> {
    let positions = [] as Position[];
    //let [total, estimates] = await enso.platform.oracles.protocols.uniswapOracle.estimateTotal(pool, underlying);
    let [total, estimates] = await estimateTokens(oracle, pool, underlying)
    for (let i = 0; i < underlying.length; i++) {
      const percentage = new bignumber(estimates[i].toString()).multipliedBy(1000).dividedBy(total.toString()).toFixed(0);
      positions.push({
        token: underlying[i],
        percentage: BigNumber.from(percentage),
      });
    }
    const totalPercentage = positions.map((pos) => Number(pos.percentage)).reduce((a, b) => a + b)
    if (totalPercentage !== 1000) {
      const lastPos = positions[positions.length - 1]
      if (totalPercentage < 1000) {
          lastPos.percentage = lastPos.percentage ? lastPos.percentage.add(1000 - totalPercentage) : BigNumber.from(0)
      } else {
          lastPos.percentage = lastPos.percentage ? lastPos.percentage.sub(totalPercentage - 1000) : BigNumber.from(0)
      }
      positions[positions.length - 1] = lastPos
    }
    return prepareStrategy(positions, adapter);
}

export async function estimateTokens(oracle: Contract, account: string, tokens: string[]): Promise<[BigNumber, BigNumber[]]> {
    const tokensAndBalances = await Promise.all(tokens.map(async (token) => {
        const erc20 = IERC20__factory.connect(token, ethers.provider)
        const balance = await erc20.balanceOf(account)
        return {
          token: token,
          balance: balance
        }
    }))
    const estimates = await Promise.all(tokensAndBalances.map(async (obj) =>
        oracle.estimateItem(obj.balance, obj.token)
    ))
    const total = estimates.reduce((a, b) => a.add(b))

    return [total, estimates]

}
