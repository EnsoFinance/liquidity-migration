import hre from "hardhat";
import { ethers } from "hardhat";
import { ERC20Mock__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, BigNumber, constants } from "ethers";
import { LP_TOKEN_WHALES } from "../tasks/initMasterUser";
import { DHedgeEnvironmentBuilder } from "../src/dhedge";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { PowerpoolEnvironmentBuilder } from "../src/powerpool";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { setupStrategyItems } from "../src/utils";
import { EnsoBuilder, EnsoEnvironment, ESTIMATOR_CATEGORY as AcceptedProtocols } from "@enso/contracts";
import ISynthetix from "@enso/contracts/artifacts/contracts/interfaces/synthetix/ISynthetix.sol/ISynthetix.json";
import ICurveAddressProvider from "@enso/contracts/artifacts/contracts/interfaces/curve/ICurveAddressProvider.sol/ICurveAddressProvider.json";
import ICurveRegistry from "@enso/contracts/artifacts/contracts/interfaces/curve/ICurveRegistry.sol/ICurveRegistry.json";
import fs from "fs";
import dictionary from "../dictionary.json";
const tokenRegistry: HashMap<TokenDictionary> = require("../dictionary.json");
const ALT_ERC20 = [
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "bytes32" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "bytes32" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

enum TokenType {
  Basic,
  DerivedToken,
}

class Token {
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  logoUri: string;

  constructor(chainId: number, name: string, symbol: string, decimals: number, address: string, logoUri?: string) {
    this.chainId = chainId;
    this.name = name;
    this.symbol = symbol;
    this.decimals = decimals;
    this.address = address;
    this.logoUri = logoUri ?? "https://etherscan.io/images/main/empty-token.png";
  }
}

type Position = {
  token: string;
  adapters: string[];
  path: string[];
};

type DerivedAsset = {
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  logoUri: string;
  apy: number;
  position: Position;
  protocol: AcceptedProtocols;
  type: TokenType;
};

type TokenDictionary = {
  token: Token;
  derivedAssets: DerivedAsset[];
};

// type TokenMap = Map<string, TokenDictionary>;

interface HashMap<T> {
  [key: string]: T;
}
class UnderlyingTokens {
  enso: EnsoEnvironment;
  signer: SignerWithAddress;
  dictionary: HashMap<TokenDictionary>;
  tokens: string[];

  constructor(enso: EnsoEnvironment, signer: SignerWithAddress) {
    this.enso = enso;
    this.signer = signer;
    this.dictionary = tokenRegistry;
    this.tokens = [];
  }

  addTokens(tokens: string[]) {
    if (tokens.length === 0) throw Error("LP failed to provide tokens");
    tokens.forEach(t => this.addToken(t));
  }

  addToken(token: string) {
    this.tokens = Array.from(new Set([...this.tokens, token]));
  }

  async findSupportedProtocol(token: Token): Promise<AcceptedProtocols> {
    const addressProvider = await this.enso.adapters.curve?.contract.addressProvider();
    // curve
    const curveAddressProvider = new Contract(addressProvider, ICurveAddressProvider.abi, this.signer);
    const curveRegistry = new Contract(await curveAddressProvider.get_registry(), ICurveRegistry.abi, this.signer);
    if (token.name.includes("gauge")) {
      return AcceptedProtocols.CURVE_GAUGE;
    }
    try {
      const curvePool = await curveRegistry.get_pool_from_lp_token(token.address);
      console.log("curve  pooL: ", curvePool);
      if (curvePool != constants.AddressZero) {
        return AcceptedProtocols.CURVE;
      }
    } catch {}
    // aave
    try {
      if (await this.enso.adapters.aaveborrow?.contract._checkAToken(token.address)) {
        // TODO: should this be aave_lend?
        return AcceptedProtocols.AAVE;
      }
    } catch {
      if (await this.enso.adapters.aavelend?.contract._checkAToken(token.address)) {
        return AcceptedProtocols.AAVE;
      }
    }
    try {
      if (await this.enso.adapters.leverage?.contract._checkAToken(token.address)) {
        return AcceptedProtocols.AAVE_DEBT;
      }
    } catch {}
    // compound
    try {
      if (await this.enso.adapters.compound?.contract._checkCToken(token.address)) {
        return AcceptedProtocols.COMPOUND;
      }
    } catch {}

    // TODO: how to check if synth?
    const synthetix = new Contract(
      await this.enso.adapters.synthetix?.contract.resolveSynthetix(),
      ISynthetix.abi,
      this.signer,
    );
    return AcceptedProtocols.DEFAULT_ORACLE;
  }

  getAdapter(protocol: AcceptedProtocols): string | undefined {
    switch (protocol) {
      case AcceptedProtocols.AAVE:
        if (this.enso.adapters.aavelend) return this.enso.adapters.aavelend.contract.address;
        break;
      case AcceptedProtocols.AAVE_DEBT:
        if (this.enso.adapters.leverage) return this.enso.adapters.leverage.contract.address;
        break;
      case AcceptedProtocols.BALANCER:
        if (this.enso.adapters.balancer) return this.enso.adapters.balancer.contract.address;
        break;
      case AcceptedProtocols.CHAINLINK_ORACLE:
        if (this.enso.adapters.synthetix) return this.enso.adapters.synthetix.contract.address;
        break;
      case AcceptedProtocols.CURVE:
        if (this.enso.adapters.curve) return this.enso.adapters.curve.contract.address;
        break;
      case AcceptedProtocols.DEFAULT_ORACLE:
        if (this.enso.adapters.uniswap) return this.enso.adapters.uniswap.contract.address;
        break;
      case AcceptedProtocols.YEARN_V2:
        // if (this.enso.adapters.yearn) return this.enso.adapters.yearn.contract.address;
        throw Error("Yearn not added to sdk");
        break;
      // TODO: CURVE gauge on sdk
      case AcceptedProtocols.CURVE_GAUGE:
        throw Error("Curve Gauge not added to sdk");
        break;
      // TODO: sushi sdk
      case AcceptedProtocols.SUSHI_FARM:
        throw Error("Sushi farm not added to sdk");

      default:
        throw Error("Couldnt find adapter");
    }
  }

  // Search dictionary for base token
  findBase(addr: string): string | undefined {
    // for (let key of this.dictionary.keys()) {
    // if (this.dictionary.get(key)?.derivedAssets.filter(d => d.address.toLowerCase() == addr)) return key;
    // }
    return undefined;
  }

  async addToTokenRegistry(tokens: string[]) {
    const toks = await this.getTokensInfo(tokens);
    for (let i = 0; i < tokens.length; i++) {
      // console.log('1: ', tokens[i].toLowerCase())
      // console.log('2: ', this.dictionary[tokens[i].toLowerCase()].token.address);
      // If no matching regular token
      if (!this.dictionary[tokens[i].toLowerCase()]) {
        // Look through  dictionary for this derived asset
        // Is this already saved as underlying asset?
        if (!this.findBase(tokens[i])) {
          let protocol: AcceptedProtocols = await this.findSupportedProtocol(toks[i]);
          // Is it a derived token?
          if (protocol != AcceptedProtocols.DEFAULT_ORACLE) {
            let adapter = this.getAdapter(protocol);
            //let position = await setupStrategyItems(this.enso.platform.oracles.ensoOracle, adapter, this.signer.address, underlyingTokens);
            const derivedAsset: DerivedAsset = {
              chainId: toks[i].chainId,
              name: toks[i].name,
              symbol: toks[i].symbol,
              decimals: toks[i].decimals,
              address: toks[i].address,
              logoUri: toks[i].logoUri,
              apy: 0, // TODO: apy??
              position: {} as Position,
              protocol: protocol,
              type: TokenType.DerivedToken,
            };

            console.log("new token: ", derivedAsset);
            // TODO: need way to find underyling
            // this.dictionary.set(("Unknown:" + tokens[i], [derivedAsset]);
          } else {
            // regular token
            const dict: TokenDictionary = {
              token: toks[i],
              derivedAssets: [{}] as DerivedAsset[],
            };
            console.log("new token: ", dict);
            this.dictionary[tokens[i].toLowerCase()] = dict;
          }
        }
      }
    }
  }

  async getTokensInfo(tokens: string[]): Promise<Token[]> {
    if (tokens.length === 0) throw Error("No tokens to get details of");

    const detailedTokens: Token[] = [] as Token[];

    for (let i = 0; i < tokens.length; i++) {
      let erc20;
      let decimals: number;
      let name: string;
      let symbol: string;

      try {
        erc20 = new ERC20Mock__factory(this.signer).attach(tokens[i]);
        [decimals, name, symbol] = await Promise.all([
          await erc20.decimals(),
          await erc20.name(),
          await erc20.symbol(),
        ]);
      } catch {
        erc20 = new Contract(tokens[i], ALT_ERC20, this.signer);
        [decimals, name, symbol] = await Promise.all([
          await erc20.decimals(),
          await erc20.name(),
          await erc20.symbol(),
        ]);
        symbol = ethers.utils.parseBytes32String(symbol);
        name = ethers.utils.parseBytes32String(name);
        decimals = BigNumber.from(decimals).toNumber();
      }

      if (!decimals || !name) throw Error("Failed to get symbol/name for: " + tokens[i]);

      detailedTokens.push(new Token(1, name, symbol, decimals, tokens[i]));
    }
    return detailedTokens;
  }

  async writeTokens() {
    const data = JSON.stringify(await this.getTokensInfo(this.tokens), null, 2);
    fs.writeFileSync("./underlying_tokens.json", data);
  }

  async writeDictionary() {
    const data = JSON.stringify(this.dictionary, null, 2);
    fs.writeFileSync("./dictionary.json", data);
  }
}

async function main() {
  // @ts-ignore
  const signer = await ethers.getSigner();

  let enso, dhedge, indexed, powerpool, piedao;

  [enso, dhedge, indexed, powerpool, piedao] = await Promise.all([
    await new EnsoBuilder(signer)
      .addAdapter("curve")
      .addAdapter("compound")
      .addAdapter("aavelend")
      .addAdapter("aaveborrow")
      .addAdapter("synthetix")
      .build(),
    await new DHedgeEnvironmentBuilder(signer).connect(),
    await new IndexedEnvironmentBuilder(signer).connect(),
    await new PowerpoolEnvironmentBuilder(signer).connect(),
    await new PieDaoEnvironmentBuilder(signer).connect(),
  ]);

  const tokens = new UnderlyingTokens(enso, signer);

  try {
    for (const { victim, lpTokenAddress, lpTokenName } of LP_TOKEN_WHALES) {
      switch (victim.toLowerCase()) {
        case "dhedge":
          console.info(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          tokens.addTokens(await dhedge.adapter.outputTokens(lpTokenAddress));

          break;

        case "indexed":
          console.info(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          tokens.addTokens(await indexed.adapter.outputTokens(lpTokenAddress));

          break;

        case "piedao":
          console.info(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          tokens.addTokens(await piedao.adapter.outputTokens(lpTokenAddress));

          break;

        case "powerpool":
          console.info(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          tokens.addTokens(await powerpool.adapter.outputTokens(lpTokenAddress));

          break;

        case "tokensets":
          console.info(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          const tokenset = await new TokenSetEnvironmentBuilder(signer, enso).connect(lpTokenAddress);

          tokens.addTokens(await tokenset.adapter.outputTokens(lpTokenAddress));

          break;

        case "indexcoop":
          console.info(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          const indexcoop = await new TokenSetEnvironmentBuilder(signer, enso).connect(lpTokenAddress);

          tokens.addTokens(await indexcoop.adapter.outputTokens(lpTokenAddress));

          break;

        default:
          throw Error("Failed to parse victim");
      }
    }
    await tokens.addToTokenRegistry(tokens.tokens);
    await tokens.writeDictionary();
  } catch (e) {
    console.log(e);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
