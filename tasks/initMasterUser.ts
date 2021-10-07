import { task } from "hardhat/config";
import { INIT_MASTER_USER } from "./task-names";

export const MASTER_USER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // address derived from default .env.example mnemonic
const ERC20_ABI_FRAGMENT = [
  "function transfer(address to, uint amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

export const LP_TOKEN_WHALES = [
  {
    victim: "defiPulseIndex",
    walletAddress: "0x1c631824b0551fd0540a1f198c893b379d5cf3c3",
    lpTokenAddress: "0x1494ca1f11d487c2bbe4543e90080aeba4ba3c2b",
    lpTokenName: "defiPulseIndex",
    symbol: "DPI",
  },
  {
    victim: "indexed",
    walletAddress: "0xb4d1293cd1bf493309c0d749a53de9a1b183a786",
    lpTokenAddress: "0xfa6de2697d59e88ed7fc4dfe5a33dac43565ea41",
    lpTokenName: "defiTop5",
    symbol: "DEFI5",
  },
  {
    victim: "basketDao",
    walletAddress: "0x6965292e29514e527df092659fb4638dc39e7248",
    lpTokenAddress: "0x0ac00355f80e289f53bf368c9bdb70f5c114c44b",
    lpTokenName: "BasketDaoMoneyIndex",
    symbol: "BMI",
  },
  {
    victim: "tokenSets",
    walletAddress: "0x4a8b9e2c2940fdd39aceb384654dc59acb58c337",
    lpTokenAddress: "0x23687D9d40F9Ecc86E7666DDdB820e700F954526",
    lpTokenName: "ethYieldFarm",
    adapter: "TokenSetAdapter",
    symbol: "USDAPY",
  },
  {
    victim: "tokenSets",
    walletAddress: "0x6b9dfc960299166df15ab8a85f054c69e2be2353",
    lpTokenAddress: "0x72e364F2ABdC788b7E918bc238B21f109Cd634D7",
    lpTokenName: "MetaverseIndex",
    symbol: "MVI",
    adapter: "TokenSetAdapter",
  },
  {
    victim: "indexCoop",
    walletAddress: "0x4ec7cdf61405758f5ced5e454c0b4b0f4f043df0",
    lpTokenAddress: "0x0954906da0Bf32d5479e25f46056d22f08464cab",
    lpTokenName: "Index",
    symbol: "INDEX",
  },
  {
    victim: "pieDao",
    walletAddress: "0xa11aed329616cc59e002a825f8a85f9baf4cdbfc",
    lpTokenAddress: "0x33e18a092a93ff21ad04746c7da12e35d34dc7c4",
    lpTokenName: "Metaverse NFT Index",
    symbol: "PLAY",
    adapter: "PieDaoAdapter",
  },
  {
    victim: "pieDao",
    walletAddress: "0xfad4a1f91026e62774a918202572b9be2fdcdb4e",
    lpTokenAddress: "0x9a48bd0ec040ea4f1d3147c025cd4076a2e71e3e",
    lpTokenName: "Metaverse NFT Index",
    symbol: "PLAY",
    adapter: "PieDaoAdapter",
  },
];

task(INIT_MASTER_USER, "Initialises the account of the master user", async (_taskArgs, hre) => {
  for (const { walletAddress, lpTokenAddress } of LP_TOKEN_WHALES) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [walletAddress],
    });
    const signer = await hre.ethers.getSigner(walletAddress);
    const contract = new hre.ethers.Contract(lpTokenAddress, ERC20_ABI_FRAGMENT, signer);
    const balance = await contract.balanceOf(walletAddress);
    await contract.transfer(MASTER_USER, balance);
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [walletAddress],
    });
  }
});
