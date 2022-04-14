import bignumber from "bignumber.js";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LiquidityMigrationBuilderV2 } from "../src/liquiditymigrationv2";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { PowerpoolEnvironmentBuilder } from "../src/powerpool";
import { DHedgeEnvironmentBuilder } from "../src/dhedge";
import { AcceptedProtocols, PoolsToMigrate } from "../src/types";
import {
  EnsoEnvironment,
  ITEM_CATEGORY,
  ESTIMATOR_CATEGORY,
  Position,
  Multicall,
  StrategyItem,
  InitialState,
  prepareStrategy,
  encodeSettleTransfer,
} from "@ensofinance/v1-core";
import { IERC20__factory, IAdapter } from "../typechain";
import { LP_TOKEN_WHALES } from "../tasks/initMasterUser";

export enum Networks {
  Mainnet,
  LocalTestnet,
  ExternalTestnet,
}

export function toErc20(addr: string, signer: SignerWithAddress): Contract {
  return IERC20__factory.connect(addr, signer);
}

let dhedgeAdapter: Contract;
let indexedAdapter: Contract;
let pieDaoAdapter: Contract;
let powerpoolAdapter: Contract;
let tokensetsAdapter: Contract;
let indexCoopAdapter: Contract;

const strategyItemTuple =
  "tuple(address item, int256 percentage, tuple(address[] adapters, address[] path, bytes cache) data)";
const strategyStateTuple =
  "tuple(uint32 timelock, uint16 rebalanceThreshold, uint16 slippage, uint16 performanceFee, bool social, bool set)";
const initialStateTuple =
  "tuple(uint32 timelock, uint16 rebalanceThreshold, uint16 rebalanceSlippage, uint16 restructureSlippage, uint16 performanceFee, bool social, bool set)";

export function encodeStrategyData(
  manager: string,
  name: string,
  symbol: string,
  strategyItems: StrategyItem[],
  strategyState: InitialState,
  router: string,
  data: string,
): string {
  return ethers.utils.defaultAbiCoder.encode(
    ["address", "string", "string", `${strategyItemTuple}[]`, initialStateTuple, "address", "bytes"],
    [manager, name, symbol, strategyItems, strategyState, router, data],
  );
}

export async function encodeMigrationData(
  adapter: Contract,
  router: Contract,
  lp: string,
  strategy: string,
  underlyingTokens: string[],
  amount: number | BigNumber,
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
  await ethers.provider.send("evm_increaseTime", [seconds]);
  return ethers.provider.send("evm_mine", []);
}

export async function getBlockTime(timeInSeconds: number): Promise<BigNumber> {
  const blockNumber = await ethers.provider.send("eth_blockNumber", []);
  const block = await ethers.provider.send("eth_getBlockByNumber", [blockNumber, true]);
  return BigNumber.from(block.timestamp).add(timeInSeconds);
}

export async function setupStrategyItems(
  oracle: Contract,
  adapter: string,
  pool: string,
  underlying: string[],
): Promise<StrategyItem[]> {
  let positions = [] as Position[];
  const [total, estimates] = await estimateTokens(oracle, pool, underlying);

  for (let i = 0; i < underlying.length; i++) {
    let percentage = new bignumber(estimates[i].toString()).multipliedBy(1000).dividedBy(total.toString()).toFixed(0);
    //In case there are funds below our percentage precision. Give it 0.1%
    if (estimates[i].gt(0) && BigNumber.from(percentage).eq(0)) percentage = "1";

    const position: Position = {
      token: underlying[i],
      percentage: BigNumber.from(percentage),
    };
    if (adapter == ethers.constants.AddressZero) position.adapters = [];
    positions.push(position);
  }
  const totalPercentage = positions.map(pos => Number(pos.percentage)).reduce((a, b) => a + b);
  if (totalPercentage !== 1000) {
    // Sort positions from largest to smallest
    positions = positions.sort((a, b) => (a.percentage?.gt(b.percentage || "0") ? -1 : 1));
    if (totalPercentage < 1000) {
      const position = positions[positions.length - 1];
      position.percentage = position.percentage?.add(1000 - totalPercentage);
      positions[positions.length - 1] = position;
    } else {
      const position = positions[0];
      position.percentage = position.percentage?.sub(totalPercentage - 1000);
      positions[0] = position;
    }
  }
  return prepareStrategy(positions, adapter);
}

export type Pools = {
  liquidityMigration: Contract;
  poolsToMigrate: any;
  adapters: Contract[];
};

export const setupPools = async (signer: SignerWithAddress, enso: EnsoEnvironment) => {
  const liquidityMigrationBuilder = new LiquidityMigrationBuilderV2(signer, enso);
  let pool;
  const poolsToMigrate: any[] = [];

  for (const { victim, lpTokenAddress, lpTokenName, walletAddress } of LP_TOKEN_WHALES) {
    switch (victim.toLowerCase()) {
      case "dhedge":
        console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
        pool = await new DHedgeEnvironmentBuilder(signer, dhedgeAdapter).connect(lpTokenAddress, [walletAddress]);
        if (!dhedgeAdapter) {
          dhedgeAdapter = pool.adapter;
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.DHedge, pool.adapter as IAdapter);
        }
        poolsToMigrate.push(pool);
        break;

      case "indexed":
        console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
        pool = await new IndexedEnvironmentBuilder(signer, indexedAdapter).connect(lpTokenAddress, [walletAddress]);
        if (!indexedAdapter) {
          indexedAdapter = pool.adapter;
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Indexed, pool.adapter as IAdapter);
        }
        poolsToMigrate.push(pool);
        break;

      case "piedao":
        console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
        pool = await new PieDaoEnvironmentBuilder(signer, pieDaoAdapter).connect(lpTokenAddress, [walletAddress]);
        if (!pieDaoAdapter) {
          pieDaoAdapter = pool.adapter;
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.PieDao, pool.adapter as IAdapter);
        }
        poolsToMigrate.push(pool);
        break;

      case "powerpool":
        console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
        pool = await new PowerpoolEnvironmentBuilder(signer, powerpoolAdapter).connect(lpTokenAddress, [walletAddress]);
        if (!powerpoolAdapter) {
          powerpoolAdapter = pool.adapter;
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Powerpool, pool.adapter as IAdapter);
        }
        poolsToMigrate.push(pool);
        break;

      case "tokensets":
        console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
        pool = await new TokenSetEnvironmentBuilder(signer, enso, tokensetsAdapter).connect(lpTokenAddress, [
          walletAddress,
        ]);
        if (!tokensetsAdapter) {
          tokensetsAdapter = pool.adapter;
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.TokenSets, pool.adapter as IAdapter);
        }
        poolsToMigrate.push(pool);
        break;

      case "indexcoop":
        console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
        pool = await new TokenSetEnvironmentBuilder(signer, enso, indexCoopAdapter).connect(lpTokenAddress, [
          walletAddress,
        ]);
        if (!indexCoopAdapter) {
          indexCoopAdapter = pool.adapter;
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.IndexCoop, pool.adapter as IAdapter);
        }
        poolsToMigrate.push(pool);
        break;

      default:
        throw Error("Failed to parse victim");
    }
  }
  // deploy liqudity migration
  const lm = await liquidityMigrationBuilder.deploy();

  // add pools to adapters
  const txs = await Promise.all(poolsToMigrate.map(async p => await p.adapter.add(p.pool.address)));

  await Promise.all(txs.map(async p => await p.wait()));

  return [lm.liquidityMigration, poolsToMigrate];
};

export async function estimateTokens(
  oracle: Contract,
  account: string,
  tokens: string[],
): Promise<[BigNumber, BigNumber[]]> {
  const tokensAndBalances = await Promise.all(
    tokens.map(async token => {
      const erc20 = IERC20__factory.connect(token, ethers.provider);
      const balance = await erc20.balanceOf(account);
      return {
        token: token,
        balance: balance,
      };
    }),
  );
  /*
    const estimates = []
    for (let i = 0; i < tokensAndBalances.length; i++) {
      console.log('Token: ', tokensAndBalances[i].token)
      console.log('Balance: ', tokensAndBalances[i].balance.toString())
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
  const estimates = await Promise.all(
    tokensAndBalances.map(async obj => oracle["estimateItem(uint256,address)"](obj.balance, obj.token)),
  );
  const total = estimates.reduce((a, b) => a.add(b));

  return [total, estimates];
}

// Register tokens
export async function addItemsToRegistry(factory: Contract) {
  // Compound
  await factory.addItemToRegistry(
    ITEM_CATEGORY.BASIC,
    ESTIMATOR_CATEGORY.COMPOUND,
    "0x70e36f6BF80a52b3B46b3aF8e106CC0ed743E8e4",
  ); //cCOMP
  await factory.addItemToRegistry(
    ITEM_CATEGORY.BASIC,
    ESTIMATOR_CATEGORY.COMPOUND,
    "0x35A18000230DA775CAc24873d00Ff85BccdeD550",
  ); //cUNI
  // Curve
  await factory.addItemToRegistry(
    ITEM_CATEGORY.BASIC,
    ESTIMATOR_CATEGORY.CURVE_LP,
    "0x4f3E8F405CF5aFC05D68142F3783bDfE13811522",
  ); //usdn3CRV
  await factory.addItemToRegistry(
    ITEM_CATEGORY.BASIC,
    ESTIMATOR_CATEGORY.CURVE_LP,
    "0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a",
  ); //BUSD3CRV-f
  await factory.addItemToRegistry(
    ITEM_CATEGORY.BASIC,
    ESTIMATOR_CATEGORY.CURVE_LP,
    "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA",
  ); //LUSD3CRV-f
  await factory.addItemToRegistry(
    ITEM_CATEGORY.BASIC,
    ESTIMATOR_CATEGORY.CURVE_LP,
    "0x7Eb40E450b9655f4B3cC4259BCC731c63ff55ae6",
  ); //USDP/3Crv
  // YEarn
  await factory.addItemToRegistry(
    ITEM_CATEGORY.BASIC,
    ESTIMATOR_CATEGORY.YEARN_V2,
    "0x3B96d491f067912D18563d56858Ba7d6EC67a6fa",
  ); //yvCurve-USDN
  await factory.addItemToRegistry(
    ITEM_CATEGORY.BASIC,
    ESTIMATOR_CATEGORY.YEARN_V2,
    "0x6ede7f19df5df6ef23bd5b9cedb651580bdf56ca",
  ); //yvCurve-BUSD
  await factory.addItemToRegistry(
    ITEM_CATEGORY.BASIC,
    ESTIMATOR_CATEGORY.YEARN_V2,
    "0x5fA5B62c8AF877CB37031e0a3B2f34A78e3C56A6",
  ); //yvCurve-LUSD
  await factory.addItemToRegistry(
    ITEM_CATEGORY.BASIC,
    ESTIMATOR_CATEGORY.YEARN_V2,
    "0xC4dAf3b5e2A9e93861c3FBDd25f1e943B8D87417",
  ); //yvCurve-USDP
}
