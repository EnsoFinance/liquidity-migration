import hre from "hardhat";
import { ethers } from "hardhat";
import { ERC20Mock__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, BigNumber } from "ethers";
import { LP_TOKEN_WHALES } from "../tasks/initMasterUser";
import { DHedgeEnvironmentBuilder } from "../src/dhedge";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { PowerpoolEnvironmentBuilder } from "../src/powerpool";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { EnsoBuilder, EnsoEnvironment } from "@enso/contracts";
import fs from "fs";
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

enum CoreProtocols {
  Unknown,
  Aave,
  Balancer,
  Compound,
  Curve,
  Sushi,
  Synthetix,
  UniswapV2,
  UniswapV3,
  Yearn,
}

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
  protocol: CoreProtocols;
  type: TokenType;
};

type TokenDictionary = {
  token: Token;
  derivedAssets: DerivedAsset[];
};

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

  async findSupportedProtocol(token: Token): Promise<CoreProtocols> {
    if (token.name.includes("gauge")) {
      return CoreProtocols.Curve;
    }

    try {
      if (await this.enso.adapters.aaveborrow.contract?._checkAToken(token.address)) {
        return CoreProtocols.Aave;
      }
    } catch {
      if (await this.enso.adapters.aavelend.contract?._checkAToken(token.address)) {
        return CoreProtocols.Aave;
      }
    }

    // try {
    // TODO: add compound adapter to enso sdk
    //   if (await this.enso.adapters.compound.contract?._checkAToken(token.address)) {
    //     return CoreProtocols.Compound;
    //   }
    // } catch {}
    // }
    return CoreProtocols.Unknown;
  }

  async getUnderlying(token: Token, protocol: CoreProtocols) {}

  async toTokenRegistry(tokens: string[]): Promise<HashMap<TokenDictionary>> {
    const toks = await this.getTokensInfo(tokens);
    for (let i = 0; i < tokens.length; i++) {
      if (!(this.dictionary[tokens[i].toLowerCase()].token.address == tokens[i])) {
        const token = this.dictionary[tokens[i].toLowerCase()].derivedAssets.find(a => a.address == tokens[i]);

        if (!token) {
          let protocol: CoreProtocols = await this.findSupportedProtocol(toks[i]);
        }
      }
    }

    return this.dictionary;
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
        erc20 = await new ERC20Mock__factory(this.signer).attach(tokens[i]);

        [decimals, name, symbol] = await Promise.all([await erc20.decimals(), await erc20.name(), await erc20.symbol()]);
      } catch {
        erc20 = new Contract(tokens[i], ALT_ERC20, this.signer);

        [decimals, name, symbol] = await Promise.all([await erc20.decimals(), await erc20.name(), await erc20.symbol()]);

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

  async writeDictionary(tokens: HashMap<TokenDictionary>) {
    const data = JSON.stringify(tokens, null, 2);

    fs.writeFileSync("./dictionary_new.json", data);
  }
}

async function main() {
  // @ts-ignore
  const signer = await ethers.getSigner();

  let enso, dhedge, indexed, powerpool, piedao;

  [enso, dhedge, indexed, powerpool, piedao] = await Promise.all([
    await new EnsoBuilder(signer).mainnet().build(),
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
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          tokens.addTokens(await dhedge.adapter.outputTokens(lpTokenAddress));

          break;

        case "indexed":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          tokens.addTokens(await indexed.adapter.outputTokens(lpTokenAddress));

          break;

        case "piedao":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          tokens.addTokens(await piedao.adapter.outputTokens(lpTokenAddress));

          break;

        case "powerpool":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          tokens.addTokens(await powerpool.adapter.outputTokens(lpTokenAddress));

          break;

        case "tokensets":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          const tokenset = await new TokenSetEnvironmentBuilder(signer, enso).connect(lpTokenAddress);

          tokens.addTokens(await tokenset.adapter.outputTokens(lpTokenAddress));

          break;

        case "indexcoop":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);

          const indexcoop = await new TokenSetEnvironmentBuilder(signer, enso).connect(lpTokenAddress);

          tokens.addTokens(await indexcoop.adapter.outputTokens(lpTokenAddress));

          break;

        default:
          throw Error("Failed to parse victim");
      }
      tokens.writeTokens();
    }
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
