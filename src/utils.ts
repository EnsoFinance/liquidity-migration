const hre = require("hardhat");
const { ethers } = hre;
import { BigNumber, Contract, Signer } from "ethers";
const { ZERO_ADDRESS, getContractFactory } = ethers;

export const deployPlatform = async (owner: Signer, uniswapFactory: string, weth: string) => {
  const Oracle = await getContractFactory("UniswapNaiveOracle");
  const oracle = await Oracle.connect(owner).deploy(uniswapFactory, weth);
  await oracle.deployed();

  const Whitelist = await getContractFactory("TestWhitelist");
  const whitelist = await Whitelist.connect(owner).deploy();
  await whitelist.deployed();

  const StrategyControllerAdmin = await getContractFactory("StrategyControllerAdmin");
  const controllerAdmin = await StrategyControllerAdmin.connect(owner).deploy();
  await controllerAdmin.deployed();

  const controllerAddress = await controllerAdmin.controller();
  const StrategyController = await getContractFactory("StrategyController");
  const controller = await StrategyController.attach(controllerAddress);

  const Strategy = await getContractFactory("Strategy");
  const strategyImplementation = await Strategy.connect(owner).deploy();
  await strategyImplementation.deployed();

  const StrategyProxyFactoryAdmin = await getContractFactory("StrategyProxyFactoryAdmin");
  const factoryAdmin = await StrategyProxyFactoryAdmin.connect(owner).deploy(
    strategyImplementation.address,
    controllerAddress,
    oracle.address,
    whitelist.address,
  );
  await factoryAdmin.deployed();

  const factoryAddress = await factoryAdmin.factory();
  const StrategyProxyFactory = await getContractFactory("StrategyProxyFactory");
  const strategyFactory = await StrategyProxyFactory.attach(factoryAddress);

  return [strategyFactory, controller, oracle, whitelist];
};

export const deployLoopRouter = async (owner: Signer, controller: Contract, adapter: Contract, weth: Contract) => {
  const LoopRouter = await getContractFactory("LoopRouter");
  const router = await LoopRouter.connect(owner).deploy(adapter.address, controller.address, weth.address);
  await router.deployed();

  return router;
};

export const deployGenericRouter = async (owner: Signer, controller: Contract, weth: Contract) => {
  const GenericRouter = await ethers.getContractFactory("GenericRouter");
  const router = await GenericRouter.connect(owner).deploy(controller.address, weth.address);
  await router.deployed();
  return router;
};
