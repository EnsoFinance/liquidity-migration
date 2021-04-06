// import { deployPlatform } from "enso";

// module.exports = {
//   deployPlatform: async (owner: Signer, uniswapFactory, weth) => {
//     const Oracle = await getContractFactory("UniswapNaiveOracle");
//     const oracle = await Oracle.connect(owner).deploy(uniswapFactory.address, weth.address);
//     await oracle.deployed();

//     const Whitelist = await getContractFactory("TestWhitelist");
//     const whitelist = await Whitelist.connect(owner).deploy();
//     await whitelist.deployed();

//     const StrategyControllerAdmin = await getContractFactory("StrategyControllerAdmin");
//     const controllerAdmin = await StrategyControllerAdmin.connect(owner).deploy();
//     await controllerAdmin.deployed();

//     const controllerAddress = await controllerAdmin.controller();
//     const StrategyController = await getContractFactory("StrategyController");
//     const controller = await StrategyController.attach(controllerAddress);

//     const Strategy = await getContractFactory("Strategy");
//     const strategyImplementation = await Strategy.connect(owner).deploy();
//     await strategyImplementation.deployed();

//     const StrategyProxyFactoryAdmin = await getContractFactory("StrategyProxyFactoryAdmin");
//     const factoryAdmin = await StrategyProxyFactoryAdmin.connect(owner).deploy(
//       strategyImplementation.address,
//       controllerAddress,
//       oracle.address,
//       whitelist.address,
//     );
//     await factoryAdmin.deployed();

//     const factoryAddress = await factoryAdmin.factory();
//     const StrategyProxyFactory = await getContractFactory("StrategyProxyFactory");
//     const strategyFactory = await StrategyProxyFactory.attach(factoryAddress);

//     return [strategyFactory, controller, oracle, whitelist];
//   },
//   deployLoopRouter: async (owner, controller, adapter, weth) => {
//     const LoopRouter = await getContractFactory("LoopRouter");
//     const router = await LoopRouter.connect(owner).deploy(adapter.address, controller.address, weth.address);
//     await router.deployed();

//     return router;
//   },
//   deployGenericRouter: async (owner, controller, weth) => {
//     const GenericRouter = await ethers.getContractFactory("GenericRouter");
//     const router = await GenericRouter.connect(owner).deploy(controller.address, weth.address);
//     await router.deployed();
//     return router;
//   },
// };
