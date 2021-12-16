import { task } from "hardhat/config";
import { INIT_MASTER_USER } from "./task-names";

export const MASTER_USER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // address derived from default .env.example mnemonic
const ERC20_ABI_FRAGMENT = [
  "function transfer(address to, uint amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

export const LP_TOKEN_WHALES = [
  {
    victim: "indexCoop",
    walletAddress: "0x051135B3395913810Fe2919c0E3ef21bcBCDB061",
    lpTokenAddress: "0x33d63ba1e57e54779f7ddaeaa7109349344cf5f1",
    lpTokenName: "DATA Economy Index",
    symbol: "DATA",
    adapter: "IndexCoopAdapter",
  },
  {
    victim: "indexCoop",
    walletAddress: "0x96E3d09A600b15341Cc266820106A1d6B4aa58C2",
    lpTokenAddress: "0x1494ca1f11d487c2bbe4543e90080aeba4ba3c2b",
    lpTokenName: "DefiPulse Index",
    symbol: "DPI",
    adapter: "IndexCoopAdapter",
  },
  {
    victim: "indexCoop",
    walletAddress: "0xBAdb34560712bf98c93E168Bf9343fb627162eDd",
    lpTokenAddress: "0x72e364f2abdc788b7e918bc238b21f109cd634d7",
    lpTokenName: "Metaverse Index",
    symbol: "MVI",
    adapter: "IndexCoopAdapter",
  },
  {
    victim: "indexCoop",
    walletAddress: "0x65bdef0e45b652e86973c3408c7cd24dda9d844d",
    lpTokenAddress: "0xaa6e8127831c9de45ae56bb1b0d4d4da6e5665bd",
    lpTokenName: "ETH 2x Flexible Leverage Index",
    symbol: "ETH2x-FLI",
    adapter: "IndexCoopAdapter",
  },
  {
    victim: "indexCoop",
    walletAddress: "0xf3bb86e1c877b1d1a57f6aa53d0ef73f68079a85",
    lpTokenAddress: "0x0b498ff89709d3838a063f1dfa463091f9801c2b",
    lpTokenName: "BTC 2x Flexible Leverage Index",
    symbol: "BTC2x-FLI",
    adapter: "IndexCoopAdapter",
  },
  {
    victim: "indexCoop",
    walletAddress: "0x9e42945623dee3efb68797f4bdd52e6fed5c5601",
    lpTokenAddress: "0x2af1df3ab0ab157e1e2ad8f88a7d04fbea0c7dc6",
    lpTokenName: "Bankless BED Index",
    symbol: "BED",
    adapter: "IndexCoopAdapter",
  },
  {
    victim: "indexed",
    walletAddress: "0x700ba21Ff04A8CA6a81A5aAbFF79734E8572Bea8",
    lpTokenAddress: "0x126c121f99e1e211df2e5f8de2d96fa36647c855",
    lpTokenName: "DEGEN",
    symbol: "DEGEN",
    adapter: "IndexedAdapter",
  },
  {
    victim: "indexed",
    walletAddress: "0xb8F9B20B15fD45400D6F679347bD83184D67a363",
    lpTokenAddress: "0xd6cb2adf47655b1babddc214d79257348cbc39a7",
    lpTokenName: "Oracle Top 5 Tokens Index",
    symbol: "ORCL5",
    adapter: "IndexedAdapter",
  },
  {
    victim: "indexed",
    walletAddress: "0x4777AdCBd3e811b95ad256f6Ae953FF0B5288010",
    lpTokenAddress: "0x68bB81B3F67f7AAb5fd1390ECB0B8e1a806F2465",
    lpTokenName: "NFT Platform Index",
    symbol: "NFTP",
    adapter: "IndexedAdapter",
  },
  {
    victim: "powerpool",
    walletAddress: "0xe4989e7B39a21089B128908E1603fdC9939DBB78",
    lpTokenAddress: "0x26607aC599266b21d13c7aCF7942c7701a8b699c",
    lpTokenName: "Power Index Pool Token",
    symbol: "PIPT",
    adapter: "PowerPoolAdapter",
  },
  {
    victim: "powerpool",
    walletAddress: "0xd2eeff73117c86c14f11a6052620848f8dd6e0c8",
    lpTokenAddress: "0xb4bebD34f6DaaFd808f73De0d10235a92Fbb6c3D",
    lpTokenName: "Yearn Ecosystem Token Index",
    symbol: "YETI",
    adapter: "PowerPoolAdapter",
  },
  /* Contains piSushi
  {
    victim: "powerpool",
    walletAddress: "0x97283c716f72b6f716d6a1bf6bd7c3fcd840027a",
    lpTokenAddress: "0xFA2562da1Bba7B954f26C74725dF51fb62646313",
    lpTokenName: "ASSY Index",
    symbol: "ASSY",
    adapter: "PowerPoolAdapter",
  },
  */
  {
    victim: "powerpool",
    walletAddress: "0x43faf3f8bef053d901c572edc32f055c20efb764",
    lpTokenAddress: "0x9ba60bA98413A60dB4C651D4afE5C937bbD8044B",
    lpTokenName: "Yearn Lazy Ape Index",
    symbol: "YLA",
    adapter: "PowerPoolAdapter",
  },
  {
    victim: "tokenSets",
    walletAddress: "0xef1863a13b8dfa1bd542f1af79a38c18b9169e30",
    lpTokenAddress: "0x23687d9d40f9ecc86e7666dddb820e700f954526",
    lpTokenName: "ETH USD Yield Farm",
    symbol: "USDAPY",
    adapter: "TokenSetAdapter",
  },
  {
    victim: "tokenSets",
    walletAddress: "0x6c833b726cd5a6f6f6b3321cc8f444b625199fe2",
    lpTokenAddress: "0xf059afa5239ed6463a00fc06a447c14fe26406e1",
    lpTokenName: "ETH WBTC Yield Farm",
    symbol: "WBTCAPY",
    adapter: "TokenSetAdapter",
  },
  { // Contains GEL token (only on UniV3, so naive oracle doesn't work)
    victim: "tokenSets",
    walletAddress: "0xd0b342029c97f2a2e65ac660835354438ac64c2e",
    lpTokenAddress: "0xfdc4a3fc36df16a78edcaf1b837d3acaaedb2cb4",
    lpTokenName: "ScifiToken",
    symbol: "SCIFI",
    adapter: "TokenSetAdapter",
  },
  {
    victim: "tokenSets",
    walletAddress: "0xEC3281124d4c2FCA8A88e3076C1E7749CfEcb7F2", // SushiSwap Multisig holds 99.9% of supply but no ETH
    lpTokenAddress: "0x7b18913D945242A9c313573E6c99064cd940c6aF",
    lpTokenName: "Sushi DAO House",
    symbol: "sushiHOUSE",
    adapter: "TokenSetAdapter",
  },
  {
    victim: "tokenSets",
    walletAddress: "0x0C85d3c58443f5773C09579a71ceA7Ab36839EB2",
    lpTokenAddress: "0xe5feeaC09D36B18b3FA757E5Cf3F8dA6B8e27F4C",
    lpTokenName: "NFT INDEX",
    symbol: "NFTI",
    adapter: "TokenSetAdapter",
  },
  {
    victim: "tokenSets",
    walletAddress: "0x353C62f328f06aC08581DAAa735DfADc0C3297f2",
    lpTokenAddress: "0xFE05B972EAb7761B60b4A14558EAC3Fef78F306A",
    lpTokenName: "Homebrew.Finance NFT Platforms",
    symbol: "MUG",
    adapter: "TokenSetAdapter",
  },
  {
    victim: "tokenSets",
    walletAddress: "0xe933c4CC17B2394CB25cbdF086F2515aDA785cB6",
    lpTokenAddress: "0xB1F66BC5867A329cFd0465A506c4ad96e6Be1aDC",
    lpTokenName: "Metaverse Index",
    symbol: "HUUB",
    adapter: "TokenSetAdapter",
  },
  /*
  {
    victim: "tokenSets",
    walletAddress: "0xdac8bdeb1e7a6b337af8aabd786f8f1d67505d46",
    lpTokenAddress: "0xa188DA64fc4e212Cda65bD3406e0ce03a5323560",
    lpTokenName: "Tipuana Genesis Fund",
    symbol: "TGF",
    adapter: "TokenSetAdapter",
  },
  */
  {
    victim: "tokenSets",
    walletAddress: "0xf29E752a44bF6BAE8093B6917a82c118d87880d0",
    lpTokenAddress: "0xBbA8120b355bC70E771F28e151a141A126843CdF",
    lpTokenName: "Cage Meme Index",
    symbol: "CMI",
    adapter: "TokenSetAdapter",
  },
  { // Contains OHM token (only on UniV3, so naive oracle doesn't work)
    victim: "tokenSets",
    walletAddress: "0xEB80077D98A5f4407AFe29CDa0293D3f8A55805C",
    lpTokenAddress: "0xe8e8486228753E01Dbc222dA262Aa706Bd67e601",
    lpTokenName: "Arch Ethereum Web3",
    symbol: "WEB3",
    adapter: "TokenSetAdapter",
  },
  {
    victim: "dHedge",
    walletAddress: "0xdf9fd8601c68e0b2d8a58593ec47daf9362e6126",
    lpTokenAddress: "0x63ae7457b8be660daaf308a07db6bccb733b92df",
    lpTokenName: "Convex Strategies",
    symbol: "DHPT",
    adapter: "DHedgeAdapter",
  },
  {
    victim: "dHedge",
    walletAddress: "0xFEa2133278A3b35Ad142F91b15B45501B5089FA6",
    lpTokenAddress: "0x0f4c00139602ab502bc7c1c0e71d6cb72a9fb0e7",
    lpTokenName: "dHEDGE Top Index",
    symbol: "DTOP",
    adapter: "DHedgeAdapter",
  },
  {
    victim: "dHedge",
    walletAddress: "0x36D3fE4072aa4940963cE4E41Dd26525E14d3ab4",
    lpTokenAddress: "0xd076b9865feb49A43Aa38c06b0432dF6b6cBCA9E",
    lpTokenName: "Jesse Livermore Hearts Crypto",
    symbol: "DHPT",
    adapter: "DHedgeAdapter",
  },
  {
    victim: "dHedge",
    walletAddress: "0xBe86F784eb2A34a8E49F4C0BDdb919E6EF099988",
    lpTokenAddress: "0x3A4851597F36F459b58e65C55c8f3a8710313Fc7",
    lpTokenName: "SNX Debt Pool Mirror",
    symbol: "DHPT",
    adapter: "DHedgeAdapter",
  },
  {
    victim: "dHedge",
    walletAddress: "0x72bF0778874FC88F3e95ADaEcDD983B2Be665476",
    lpTokenAddress: "0x391603b1C3b03A0133AD82E91692790e58f73570",
    lpTokenName: "Guttastemning",
    symbol: "DHPT",
    adapter: "DHedgeAdapter",
  },
  {
    victim: "dHedge",
    walletAddress: "0x0b0e3Ebe78b965Bd0AE25a7C5C1cc8cFF23a07E7",
    lpTokenAddress: "0x907FeB27f8cc5b003Db7e62dfc2f9B01ce3FADd6",
    lpTokenName: "Potato_Swap",
    symbol: "DHPT",
    adapter: "DHedgeAdapter",
  },
  {
    victim: "dHedge",
    walletAddress: "0xd18ca6ad07e9D3FF226202c0e22cB4A555B44e74",
    lpTokenAddress: "0x3781eA00ECBE98d1550806C1213FC7FEb4F88a42",
    lpTokenName: "Black Lion Fund",
    symbol: "DHPT",
    adapter: "DHedgeAdapter",
  },
  {
    victim: "dHedge",
    walletAddress: "0x444c996b74631763cE0c406Fcbe9Aa13D35f395E",
    lpTokenAddress: "0x0ac1DBa8252240589266194F9C27a42229E84B19",
    lpTokenName: "A-DAM Public Fund",
    symbol: "DHPT",
    adapter: "DHedgeAdapter",
  },
  /* Contains CryptoPunk
  {
    victim: "pieDao",
    walletAddress: "0x4281579d99d855f2430c95a13720e53a0fcc0549",
    lpTokenAddress: "0x33e18a092a93ff21ad04746c7da12e35d34dc7c4",
    lpTokenName: "Metaverse NFT Index",
    symbol: "PLAY",
    adapter: "PieDaoAdapter",
  },
  */
  {
    victim: "pieDao",
    walletAddress: "0xfad4a1f91026e62774a918202572b9be2fdcdb4e",
    lpTokenAddress: "0x9a48bd0ec040ea4f1d3147c025cd4076a2e71e3e",
    lpTokenName: "PieDAO USD++ Pool",
    symbol: "USD++",
    adapter: "PieDaoAdapter",
  },
  /* Contains Aave V1 + xSUSHI
  {
    victim: "pieDao",
    walletAddress: "0x1333be3f438607fed776b23baec4a506f218a1ad",
    lpTokenAddress: "0x17525e4f4af59fbc29551bc4ece6ab60ed49ce31",
    lpTokenName: "PieDAO Yearn Ecosystem Pie",
    symbol: "YPIE",
    adapter: "PieDaoAdapter",
  },
  */
  /* Contains Aave V1 + xSUSHI
  {
    victim: "pieDao",
    walletAddress: "0x115f95c00e8cf2f5c57250caa555a6b4e50b446b",
    lpTokenAddress: "0x78f225869c08d478c34e5f645d07a87d3fe8eb78",
    lpTokenName: "PieDAO DEFI Large Cap",
    symbol: "DEFI+L",
    adapter: "PieDaoAdapter",
  },
  */
  {
    victim: "pieDao",
    walletAddress: "0xd68a5ccde1e5273c79cd40711fe4750122cdd865",
    lpTokenAddress: "0x0327112423f3a68efdf1fcf402f6c5cb9f7c33fd",
    lpTokenName: "PieDAO BTC++",
    symbol: "BTC++",
    adapter: "PieDaoAdapter",
  },
  {
    victim: "pieDao",
    walletAddress: "0x193bd90b68eb1df24d9c52d78960717b5e2ec9bb",
    lpTokenAddress: "0xad6a626ae2b43dcb1b39430ce496d2fa0365ba9c",
    lpTokenName: "PieDAO DEFI Small Cap",
    symbol: "DEFI+S",
    adapter: "PieDaoAdapter",
  },
  /* Contains DEFI+L and DEFI+S
  {
    victim: "pieDao",
    walletAddress: "0xf78d4b28c975353aa6ae45c31471e8ca8da0ba35",
    lpTokenAddress: "0x8d1ce361eb68e9e05573443c407d4a3bed23b033",
    lpTokenName: "PieDAO DEFI++",
    symbol: "DEFI++",
    adapter: "PieDaoAdapter",
  },
  */
  /* Contains DEFI++
  {
    victim: "pieDao",
    walletAddress: "0xebfb007ac8e6239baee43d4812e0373783e0d34f",
    lpTokenAddress: "0xe4f726adc8e89c6a6017f01eada77865db22da14",
    lpTokenName: "PieDAO Balanced Crypto Pie",
    symbol: "BCP",
    adapter: "PieDaoAdapter",
  },
  */
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
