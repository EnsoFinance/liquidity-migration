import bignumber from "bignumber.js";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import {ITEM_CATEGORY, ESTIMATOR_CATEGORY, Position, Multicall, StrategyItem, InitialState, prepareStrategy, encodeSettleTransfer } from "@enso/contracts";
import { IERC20__factory } from "../typechain";

export enum Networks {
  Mainnet,
  LocalTestnet,
  ExternalTestnet,
}

const strategyItemTuple = 'tuple(address item, int256 percentage, tuple(address[] adapters, address[] path, bytes cache) data)'
const strategyStateTuple = 'tuple(uint32 timelock, uint16 rebalanceThreshold, uint16 slippage, uint16 performanceFee, bool social, bool set)'
const initialStateTuple = 'tuple(uint32 timelock, uint16 rebalanceThreshold, uint16 rebalanceSlippage, uint16 restructureSlippage, uint16 performanceFee, bool social, bool set)'

export function encodeStrategyData(
    manager: string,
    name: string,
    symbol: string,
    strategyItems: StrategyItem[],
    strategyState: InitialState,
    router: string,
    data: string
): string {
    return ethers.utils.defaultAbiCoder.encode(
      ['address', 'string', 'string', `${strategyItemTuple}[]`, initialStateTuple, 'address', 'bytes'],
      [manager, name, symbol, strategyItems, strategyState, router, data]
    )
}

export async function encodeMigrationData(
    adapter: Contract,
    router: Contract,
    lp: string,
    strategy: string,
    underlyingTokens: string[],
    amount: number | BigNumber
): Promise<string> {
    const migrationCalls: Multicall[] = await adapter.encodeWithdraw(lp, amount);

    // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    for (let i = 0; i < underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(router, underlyingTokens[i], strategy));
    }
    // Encode multicalls for GenericRouter
    const calls: Multicall[] = [...migrationCalls, ...transferCalls];
    return router.encodeCalls(calls);
}

export async function increaseTime(seconds: number) {
	await ethers.provider.send('evm_increaseTime', [seconds])
	return ethers.provider.send('evm_mine', [])
}

export async function getBlockTime(timeInSeconds: number): Promise<BigNumber> {
  const blockNumber = await ethers.provider.send('eth_blockNumber', [])
  const block = await ethers.provider.send('eth_getBlockByNumber', [blockNumber, true])
  return BigNumber.from(block.timestamp).add(timeInSeconds)
}

export async function setupStrategyItems(oracle: Contract, adapter: string, pool: string, underlying: string[]): Promise<StrategyItem[]> {
    const positions = [] as Position[];
    const [total, estimates] = await estimateTokens(oracle, pool, underlying)
    // console.log("underlying ", underlying)
    // console.log("total", total)
    // console.log("estimates", estimates)
    for (let i = 0; i < underlying.length; i++) {
      const percentage = new bignumber(estimates[i].toString()).multipliedBy(1000).dividedBy(total.toString()).toFixed(0);
      const position: Position = {
        token: underlying[i],
        percentage: BigNumber.from(percentage),
      }
      if (adapter == ethers.constants.AddressZero) position.adapters = []
      positions.push(position);
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
    /*
    const estimates = []
    for (let i = 0; i < tokensAndBalances.length; i++) {
      console.log('Token: ', tokensAndBalances[i].token)
      try {
        const estimate = await oracle.estimateItem(tokensAndBalances[i].balance, tokensAndBalances[i].token)
        console.log('Estimate: ', estimate.toString())
        estimates.push(estimate)
      } catch (e) {
        console.log('Estimate failed')
        estimates.push(BigNumber.from(0))
      }

    }
    */
    const estimates = await Promise.all(tokensAndBalances.map(async (obj) =>
        oracle.estimateItem(obj.balance, obj.token)
    ))
    const total = estimates.reduce((a, b) => a.add(b))

    return [total, estimates]

}

    // Register tokens
export async function addItemsToRegistry(factory: Contract) {
    // Compound
    await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.COMPOUND, '0x70e36f6BF80a52b3B46b3aF8e106CC0ed743E8e4') //cCOMP
    await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.COMPOUND, '0x35A18000230DA775CAc24873d00Ff85BccdeD550') //cUNI
    // Curve
    await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, '0x4f3E8F405CF5aFC05D68142F3783bDfE13811522') //usdn3CRV
    await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, '0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a') //BUSD3CRV-f
    await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, '0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA') //LUSD3CRV-f
    await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, '0x7Eb40E450b9655f4B3cC4259BCC731c63ff55ae6') //USDP/3Crv
    // YEarn
    await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, '0x3B96d491f067912D18563d56858Ba7d6EC67a6fa') //yvCurve-USDN
    await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, '0x6ede7f19df5df6ef23bd5b9cedb651580bdf56ca') //yvCurve-BUSD
    await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, '0x5fA5B62c8AF877CB37031e0a3B2f34A78e3C56A6') //yvCurve-LUSD
    await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, '0xC4dAf3b5e2A9e93861c3FBDd25f1e943B8D87417') //yvCurve-USDP
}