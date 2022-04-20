import fs from "fs";
import bignumber from "bignumber.js";
import { BigNumber, Contract, Event } from "ethers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LiquidityMigrationBuilderV2 } from "../src/liquiditymigrationv2";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { PowerpoolEnvironmentBuilder } from "../src/powerpool";
import { DHedgeEnvironmentBuilder } from "../src/dhedge";
import {
  AcceptedProtocols,
  StakedPool,
  ScriptOutput,
  StrategyParamsJson,
  InitialStateJson,
  StrategyItemJson,
  StrategyParams,
} from "../src/types";
import { getAdapterFromAddr } from "./mainnet";
import { INITIAL_STATE } from "./constants";
import {
  EnsoEnvironment,
  LiveEnvironment,
  ITEM_CATEGORY,
  ESTIMATOR_CATEGORY,
  Position,
  Multicall,
  StrategyItem,
  InitialState,
  prepareStrategy,
  encodeSettleTransfer,
} from "@ensofinance/v1-core";
import { ERC20__factory, IAdapter, IStrategy__factory } from "../typechain";
import { LP_TOKEN_WHALES } from "../tasks/initMasterUser";

export enum Networks {
  Mainnet,
  LocalTestnet,
  ExternalTestnet,
}

export function toErc20(addr: string, signer: SignerWithAddress): Contract {
  return ERC20__factory.connect(addr, signer);
}

export function write2File(fileName: string, json: ScriptOutput) {
  const data = JSON.stringify(json, null, 4);
  fs.writeFileSync("out/" + fileName, data);
}

export async function getNameOrDefault(erc20: Contract): Promise<string> {
  let name = "unknown";
  try {
    name = await erc20.name();
  } catch {}
  return `Enso ${name}`;
}

export async function getSymbolOrDefault(erc20: Contract): Promise<string> {
  let symbol = "unknown";
  try {
    symbol = await erc20.symbol();
  } catch {}
  return symbol;
}

export async function getStrategyCreationParams(
  signer: SignerWithAddress,
  enso: LiveEnvironment,
  stakedLP: string,
  manager: string,
  adapterAddr: string,
  initialState?: InitialState,
  stratName?: string,
  stratSymbol?: string,
): Promise<StrategyParams> {
  const erc20LP = toErc20(stakedLP, signer);
  // Check optional params
  const name: string = stratName || (await getNameOrDefault(erc20LP));
  const symbol: string = stratSymbol || (await getNameOrDefault(erc20LP));
  const state: InitialState = initialState || INITIAL_STATE;
  // Get underlying assets
  const adapter = await getAdapterFromAddr(adapterAddr, signer);
  const underlying = await adapter.outputTokens(stakedLP);
  // TODO: get leverage adapter when needed
  const items = await setupStrategyItems(
    enso.platform.oracles.ensoOracle,
    enso.adapters.uniswapV3.address,
    stakedLP,
    underlying,
  );
  const params: StrategyParams = {
    name,
    symbol,
    manager,
    items,
    state,
  };
  return params;
}

export async function deployStrategy(
  enso: LiveEnvironment,
  name: string,
  symbol: string,
  items: StrategyItem[],
  state: InitialState,
  signer: SignerWithAddress,
): Promise<string> {
  const tx = await enso.platform.strategyFactory.createStrategy(
    signer.address,
    name,
    symbol,
    items,
    state,
    ethers.constants.AddressZero,
    "0x",
  );
  const receipt = await tx.wait();
  console.log("Strategy creation cost: ", receipt.gasUsed);
  return receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
}

// TODO: pass state as param
export async function deployStakedStrategy(
  enso: LiveEnvironment,
  stakedLP: string,
  migrationAdapter: string,
  signer: SignerWithAddress,
  stratName?: string,
  symbol?: string,
): Promise<Contract> {
  if (!stratName) stratName = stakedLP.slice(8);
  if (!symbol) symbol = stakedLP.slice(4);
  const adapter = await getAdapterFromAddr(migrationAdapter, signer);
  const underlying = await adapter.outputTokens(stakedLP);
  const strategyItems = await setupStrategyItems(
    enso.platform.oracles.ensoOracle,
    enso.adapters.uniswapV3.address,
    stakedLP,
    underlying,
  );
  const strategy = IStrategy__factory.connect(
    await deployStrategy(enso, stratName, symbol, strategyItems, INITIAL_STATE, signer),
    signer,
  );
  return strategy;
}

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

export function fromJsonStrategyParams(paramsJson: StrategyParamsJson): StrategyParams {
  const items = paramsJson.items.map(i => {
    const { item, data } = i;
    const percentage = BigNumber.from(i.percentage);
    return { item, data, percentage } as StrategyItem;
  });
  const state: InitialState = {
    timelock: BigNumber.from(paramsJson.state.timelock),
    rebalanceThreshold: BigNumber.from(paramsJson.state.rebalanceThreshold),
    rebalanceSlippage: BigNumber.from(paramsJson.state.rebalanceSlippage),
    restructureSlippage: BigNumber.from(paramsJson.state.restructureSlippage),
    performanceFee: BigNumber.from(paramsJson.state.performanceFee),
    social: paramsJson.state.social,
    set: paramsJson.state.set,
  };
  const { name, symbol, manager } = paramsJson;
  return { name, symbol, manager, state, items } as StrategyParams;
}

export function toJsonStrategyParams(params: StrategyParams): StrategyParamsJson {
  const items: StrategyItemJson[] = params.items.map(d => {
    const { item, data } = d;
    const percentage = d.percentage.toString();
    return { item, data, percentage } as StrategyItemJson;
  });
  const state = {
    timelock: params.state.timelock.toString(),
    rebalanceThreshold: params.state.rebalanceThreshold.toString(),
    rebalanceSlippage: params.state.rebalanceSlippage.toString(),
    restructureSlippage: params.state.restructureSlippage.toString(),
    performanceFee: params.state.performanceFee.toString(),
    social: params.state.social,
    set: params.state.set,
  } as InitialStateJson;
  const { name, symbol, manager } = params;
  return {
    name,
    symbol,
    manager,
    items,
    state,
  } as StrategyParamsJson;
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
    let percentage = estimates[i].mul(1000).mul(1e10).div(total).div(1e10);
    if (percentage.eq(BigNumber.from(0))) {
      //In case there are funds below our percentage precision. Give it 0.1%
      if (estimates[i].gt(0)) {
        console.log(`Rounding up to 1 percentage for item ${underlying[i]}`);
        percentage = BigNumber.from(1);
      } else {
        console.log(`Skipping 0 percentage item ${underlying[i]}`);
        continue;
      }
    }
    let position: Position = {
      token: underlying[i],
      percentage: percentage,
    };
    //console.log("Final percentage ", percentage);
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

let dhedgeAdapter: Contract;
let indexedAdapter: Contract;
let pieDaoAdapter: Contract;
let powerpoolAdapter: Contract;
let tokensetsAdapter: Contract;
let indexCoopAdapter: Contract;

export async function setupPools(signer: SignerWithAddress, enso: EnsoEnvironment) {
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
}

export async function estimateTokens(
  oracle: Contract,
  account: string,
  tokens: string[],
): Promise<[BigNumber, BigNumber[]]> {
  const tokensAndBalances = await Promise.all(
    tokens.map(async token => {
      const erc20 = ERC20__factory.connect(token, ethers.provider);
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
