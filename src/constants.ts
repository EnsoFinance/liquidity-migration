import { BigNumber } from "ethers";
import { StrategyState, InitialState } from "@ensofinance/v1-core";

interface Holders {
  [key: string]: string[] | undefined;
}

interface Modules {
  BASIC: string;
  NAV: string;
  DEBT: string;
}

export const FACTORY_REGISTRIES = {
  PIE_DAO_SMART_POOLS: "0xE0CBd9db30E15B9ad885D39AecaE138616807753", // pieDao registry
  DPI: "0x1494CA1F11D487c2bBe4543E90080AeBa4BA3C2b",
  ETH_2X: "0xAa6E8127831c9DE45ae56bB1b0d4D4Da6e5665BD",
  BTC_2X: "0x0b498ff89709d3838a063f1dfa463091f9801c2b",
  ETH_USD_YIELD: "0x23687D9d40F9Ecc86E7666DDdB820e700F954526",
  DEGEN_INDEX: "0x126c121f99e1E211dF2e5f8De2d96Fa36647c855",
  DHEDGE_TOP: "0x0f4c00139602ab502bc7c1c0e71d6cb72a9fb0e7",
  POWER: "0x26607aC599266b21d13c7aCF7942c7701a8b699c",
  METAVERSE: "0x72e364f2abdc788b7e918bc238b21f109cd634d7",
  ETH_WBTC_YIELD_FARM: "0xf059afa5239ed6463a00fc06a447c14fe26406e1",
  SCI_FI_TOKEN: "0xfdc4a3fc36df16a78edcaf1b837d3acaaedb2cb4",
  BANKLESS_BED_INDEX: "0x2af1df3ab0ab157e1e2ad8f88a7d04fbea0c7dc6",
};

export const PIE_DAO_HOLDERS: Holders = {
  "0x0327112423F3A68efdF1fcF402F6c5CB9f7C33fd": ["0xD68A5ccDe1e5273c79Cd40711fE4750122cdD865"], // BTC++
  "0xaD6A626aE2B43DCb1B39430Ce496d2FA0365BA9C": ["0xc1f0A5c6CFA9eDDa352336e9E8202BC097E72C68"], // DEFI+S
  "0x8D1ce361eb68e9E05573443C407D4A3Bed23B033": ["0xF78d4b28C975353aA6aE45c31471e8Ca8da0BA35"], // DEFI++
  "0xE4f726Adc8e89C6a6017F01eadA77865dB22dA14": ["0xA38dA4974B594204b73581ac5FBc1eBEE54CA4E0"], // BCP (balance crypto pie)
};

export const TOKENSET_ISSUANCE_MODULES: Modules = {
  BASIC: "0xd8EF3cACe8b4907117a45B0b125c68560532F94D",
  NAV: "0xaB9a964c6b95fA529CA7F27DAc1E7175821f2334",
  DEBT: "0x39f024d621367c044bace2bf0fb15fb3612ecb92",
};

export const TOKENSET_HOLDERS: Holders = {
  "0x1494ca1f11d487c2bbe4543e90080aeba4ba3c2b": [
    "0x229eb11d30004f46C68efDFD4d7d809b748d0e3D",
    "0xBAdb34560712bf98c93E168Bf9343fb627162eDd",
    "0x4996De5A4e624fCE5A718B2a2547901fB050C2B4",
  ], // DPI
  "0xAa6E8127831c9DE45ae56bB1b0d4D4Da6e5665BD": [
    "0x56178a0d5F301bAf6CF3e1Cd53d9863437345Bf9",
    "0x22Acb809d08aE7c79F0b84513EfCE0577acFE514",
    "0x690f1de22ee6c7c6c2433c8174cd74e82ee8563a",
    "0x65bdef0e45b652e86973c3408c7cd24dda9d844d",
  ], // ETH_2X
  "0x23687d9d40f9ecc86e7666dddb820e700f954526": [
    "0xEf1863a13b8Dfa1Bd542f1aF79A38C18b9169E30",
    "0x6b9568Ef82Ad3Ea56EdB3aAA805541A1748EFCD0",
    "0x4C55AE27581b44cD6E014bCED60d67680fc86586",
  ], // ETH_USD_YIELD
  "0x72e364f2abdc788b7e918bc238b21f109cd634d7": [
    "0xBAdb34560712bf98c93E168Bf9343fb627162eDd",
    "0xf3f5C252e8ACd60671f92c7F72cf33661221Ef42",
    "0x34e4b82C8d1BA17BEdD621a90397A8a301B27D3F",
  ], // Metaverse
  "0xf059afa5239ed6463a00fc06a447c14fe26406e1": [
    "0x0d996171e7883a286ef720030935f72d0bac8219",
    "0xe540c45c504b348ad4d6eb9344e6cfa07c959be6",
    "0x29019f271161bab81eac8d7a74017cf73b81c5cd",
  ], // ETH WBTC Yield Farm
  "0xfdc4a3fc36df16a78edcaf1b837d3acaaedb2cb4": [
    "0x77dde7a89752091f3d0349513b48d13ccc8e85b4",
    "0xe230e0992a5ff20cc8e888bee348f24dd3c2bde8",
    "0xd4136aa8b2a99654591acac5094ef199312d81bc",
  ], // ScifiToken
  "0xaa6e8127831c9de45ae56bb1b0d4d4da6e5665bd": [
    "0x65bdef0e45b652e86973c3408c7cd24dda9d844d",
    "0x22acb809d08ae7c79f0b84513efce0577acfe514",
    "0x6b9dfc960299166df15ab8a85f054c69e2be2353",
  ], // ETH 2x Flexible Leverage Index
  "0x0b498ff89709d3838a063f1dfa463091f9801c2b": [
    "0xd36c3c312261ab4aa094236066f63d6a6b4ba557",
    "0x0a9bbc4b4ac50ac1eee396b06326143d4f9422d3",
    "0x6b1aa98fed046894cfb1545d7aee30e84cfb35b6",
  ], // BTC 2x Flexible Leverage Index
  "0x2af1df3ab0ab157e1e2ad8f88a7d04fbea0c7dc6": [
    "0xf13ac6a72cc24ecf68450c1e7f5d352710e3b0e2",
    "0x0a3e93fb96470ecd34ec3226c0ab32bfccff8667",
    "0x216be72f65004cbb3eba25265df3e368bd9ec9bd",
  ], // Bankless BED Index
};

export const INDEXED_HOLDERS: Holders = {
  "0x126c121f99e1E211dF2e5f8De2d96Fa36647c855": [
    "0x82df46c9047f3218b4df0589e44f71e21f7800cb",
    "0xef764bac8a438e7e498c2e5fccf0f174c3e3f8db",
    "0x4a532E11BE441033BB64f2fE5bD3DBbC4bBe74a2",
  ], // DEGEN
};

export const POWERPOOL_HOLDERS: Holders = {
  "0x26607aC599266b21d13c7aCF7942c7701a8b699c": [
    "0xBc89aBDCed7ED9c7EcE1A13932C606EAD623C00F",
    "0xb4367aBE9d87C508eceb60c422cBBF8E34Aa8dc9",
    "0xBFd5c23A95Ca6A52BA151F8525d49890693Dd9F8",
  ], // Power Index
};

export const DHEDGE_HOLDERS: Holders = {
  "0x0f4c00139602ab502bc7c1c0e71d6cb72a9fb0e7": [
    "0xE8869DFE6492c4F6F078bA74c651B4808bfb784B",
    "0x4D89D373A7Ec36cEC559d81c3820FB22c460053f",
    "0x3CefaAe1F9ecD24762a4744B78c8e850A143570A",
  ], // DHedge Top Index
};

export const WETH: string = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

export const SUSD: string = "0x57ab1ec28d129707052df4df418d58a2d46d5f51";

export const UNISWAP_V2_ROUTER: string = "0xf164fC0Ec4E93095b804a4795bBe1e041497b92a";

export const UNISWAP_V3_ROUTER: string = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

export const DIVISOR = 1000;

export const DEPOSIT_SLIPPAGE = BigNumber.from(950);

export const STRATEGY_STATE: StrategyState = {
  timelock: BigNumber.from(60),
  rebalanceSlippage: BigNumber.from(995),
  restructureSlippage: BigNumber.from(980),
  social: true,
  set: false,
};

export const INITIAL_STATE: InitialState = {
  timelock: BigNumber.from(60), // 1 minute
  rebalanceThreshold: BigNumber.from(50), // 5%
  rebalanceSlippage: BigNumber.from(997), // 99.7 %
  restructureSlippage: BigNumber.from(995), // 99.5 %
  performanceFee: BigNumber.from(0),
  social: true,
  set: false,
};
