import hre from "hardhat";
import { ethers } from "hardhat";
import { ERC20Mock__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { LP_TOKEN_WHALES } from "../tasks/initMasterUser";
import { DHedgeEnvironmentBuilder } from "../src/dhedge";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { PowerpoolEnvironmentBuilder } from "../src/powerpool";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { EnsoBuilder } from "@enso/contracts";
import fs from "fs";

const BYTES32_SYMBOL_ABI = [
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "bytes32" }],
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
];

class Erc20 {
  address: string;
  tokenSymbol: string;
  name: string;

  constructor(addr: string, sym: string, name: string) {
    this.address = addr;
    this.tokenSymbol = sym;
    this.name = name;
  }
}

class UnderlyingTokens {
  signer: SignerWithAddress;

  tokens: string[];

  constructor(signer: SignerWithAddress) {
    this.signer = signer;

    this.tokens = [];
  }

  addTokens(tokens: string[]) {
    if (tokens.length === 0) throw Error("LP failed to provide tokens");
    tokens.forEach(t => this.addToken(t));
  }

  addToken(token: string) {
    this.tokens = Array.from(new Set([...this.tokens, token]));
  }

  async getTokenDetails(): Promise<Erc20[]> {
    if (this.tokens.length === 0) throw Error("No tokens to get details of");

    const detailedTokens: Erc20[] = [] as Erc20[];

    for (let i = 0; i < this.tokens.length; i++) {
      let erc20;

      let tokenSymbol: string;

      let name: string;

      try {
        erc20 = await new ERC20Mock__factory(this.signer).attach(this.tokens[i]);
        [tokenSymbol, name] = await Promise.all([await erc20.symbol(), await erc20.name()]);
      } catch {
        erc20 = new Contract(this.tokens[i], BYTES32_SYMBOL_ABI, this.signer);
        [tokenSymbol, name] = await Promise.all([await erc20.symbol(), await erc20.name()]);
      }

      if (tokenSymbol === "" || name === "") throw Error("Failed to get symbol/name for: " + this.tokens[i]);

      detailedTokens.push(new Erc20(this.tokens[i], tokenSymbol, name));
    }
    return detailedTokens;
  }

  async write2File() {
    const tokens = await this.getTokenDetails();

    const data = JSON.stringify(tokens, null, 2);

    fs.writeFileSync("./underlying_tokens.json", data);
  }
}

async function main() {
  // @ts-ignore
  const signer = await ethers.getSigner();

  const tokens = new UnderlyingTokens(signer);

  let enso, dhedge, indexed, powerpool, piedao;

  [enso, dhedge, indexed, powerpool, piedao] = await Promise.all([
    await new EnsoBuilder(signer).mainnet().build(),
    await new DHedgeEnvironmentBuilder(signer).connect(),
    await new IndexedEnvironmentBuilder(signer).connect(),
    await new PowerpoolEnvironmentBuilder(signer).connect(),
    await new PieDaoEnvironmentBuilder(signer).connect(),
  ]);

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
    }
    await tokens.write2File();
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
