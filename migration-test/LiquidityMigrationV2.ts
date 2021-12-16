
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigrationv2";
import { IERC20__factory, IStrategy__factory, IAdapter} from "../typechain";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { FACTORY_REGISTRIES, DEPOSIT_SLIPPAGE, INITIAL_STATE} from "../src/constants";
import { EnsoBuilder, InitialState, StrategyItem, ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "@enso/contracts";
import { WETH, SUSD, UNISWAP_V2_ROUTER } from "../src/constants";
import { setupStrategyItems, getBlockTime } from "../src/utils";

const ownerMultisig = '0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F'
const dpiPoolAddress = '0x1494ca1f11d487c2bbe4543e90080aeba4ba3c2b'
const indexCoopAdapterAddress = '0x9c9326C521895c78414BD3C2945e47AFC4Ef16cc'

describe("CurrentContracts test: (migration-tests)", function () {
  let signers: any,
    enso: any,
    indexCoopAdapter: any,
    dpiUnderlying: any,
    dpiStrategy: any,
    liquidityMigration: any;

  const dpi_setup = async function () {
    const TokenSetAdapter = await ethers.getContractFactory('TokenSetAdapter')
    indexCoopAdapter = await TokenSetAdapter.attach(indexCoopAdapterAddress)
    dpiUnderlying = await indexCoopAdapter.outputTokens(dpiPoolAddress)
    dpiStrategy = IStrategy__factory.connect(
      await deployStrategy(
        "DPI",
        "DPI",
        await setupStrategyItems(
          enso.platform.oracles.ensoOracle,
          enso.adapters.uniswap.contract.address,
          dpiPoolAddress,
          dpiUnderlying,
        ),
        INITIAL_STATE
      ),
      signers.default,
    );
    console.log("Strategy: ", dpiStrategy.address)
  };

  const deployStrategy = async (name: string, symbol: string, items: StrategyItem[], state: InitialState) => {
    const tx = await enso.platform.strategyFactory.createStrategy(
      signers.default.address,
      name,
      symbol,
      items,
      state,
      ethers.constants.AddressZero,
      "0x",
    );
    const receipt = await tx.wait();
    return receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
  };

  before(async function () {
    signers = {} as Signers;
    const allSigners = await ethers.getSigners();
    signers.default = allSigners[0];
    signers.secondary = allSigners[1];
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ownerMultisig],
    });
    signers.admin = await ethers.getSigner(ownerMultisig);
    console.log("Admin: ", signers.admin.address)
    enso = await new EnsoBuilder(signers.admin).mainnet().build();
    const lmBuilder = new LiquidityMigrationBuilder(signers.admin, enso);
    const TokenSetAdapter = await ethers.getContractFactory("TokenSetAdapter");
    lmBuilder.addAdapter(AcceptedProtocols.IndexCoop, await TokenSetAdapter.attach(indexCoopAdapterAddress) as IAdapter);
    liquidityMigration = (await lmBuilder.deploy()).liquidityMigration;
    // KNC not on Uniswap, use Chainlink
    await enso.platform.oracles.registries.chainlinkRegistry
      .connect(signers.admin)
      .addOracle(SUSD, WETH, "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", true); //sUSD
    await enso.platform.oracles.registries.chainlinkRegistry
      .connect(signers.admin)
      .addOracle(
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202",
        SUSD,
        "0xf8ff43e991a81e6ec886a3d281a2c6cc19ae70fc",
        false,
      ); //KNC
    await enso.platform.strategyFactory
      .connect(signers.admin)
      .addItemToRegistry(
        ITEM_CATEGORY.BASIC,
        ESTIMATOR_CATEGORY.CHAINLINK_ORACLE,
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202");

    await dpi_setup();

    console.log("Controller: ", enso.platform.controller.address)
    console.log("Router: ", enso.routers[0].contract.address)
    console.log("Oracle: ", enso.platform.oracles.ensoOracle.address)
  });

  it("Should update migration contract", async function () {
    await indexCoopAdapter.connect(signers.admin).updateGenericRouter(enso.routers[0].contract.address)
    await liquidityMigration.connect(signers.admin).updateController(enso.platform.controller.address)
    await liquidityMigration.connect(signers.admin).updateGeneric(enso.routers[0].contract.address)
    await liquidityMigration.connect(signers.admin).updateUnlock(await getBlockTime(0))
  })

  it("Should batch migrate", async function () {
    const eventFilter = liquidityMigration.filters.Staked(null, null, null, null)
    const events = await liquidityMigration.queryFilter(eventFilter)
    const stakers = events.filter((ev: Event) => ev?.args?.strategy.toLowerCase() === dpiPoolAddress.toLowerCase())
                        .filter((ev: Event) => ev?.args?.amount.gt(0))
                        .map((ev: Event) => ev?.args?.account)

    const users = stakers.filter((account: string, index: number) => stakers.indexOf(account) === index)
                         .slice(0,5)

    console.log("Num users: ", users.length)

    const lps = Array(users.length).fill(dpiPoolAddress)
    const adapters = Array(users.length).fill(indexCoopAdapter.address)
    const strategies = Array(users.length).fill(dpiStrategy.address)
    const slippage = Array(users.length).fill(0)
    const tx = await liquidityMigration
      .connect(signers.admin)
      ["batchMigrate(address[],address[],address[],address[],uint256[])"](
        users,
        lps,
        adapters,
        strategies,
        slippage
      );
    const receipt = await tx.wait()
    console.log('Migrate Gas Used: ', receipt.gasUsed.toString())
  });
});
