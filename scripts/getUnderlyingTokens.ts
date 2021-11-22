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

const bytes32Symbol = [{ name: "symbol_", type: "bytes32" }];

const symbol = [
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

type ERC20 = {
  address: string;
  symbol: string;
};

class UnderlyingTokens {
  signer: SignerWithAddress;

  contracts: ERC20Mock__factory[];

  tokens: string[];

  constructor(signer: SignerWithAddress) {
    this.signer = signer;

    this.contracts = [];

    this.tokens = [];
  }

  addTokens(tokens: string[]) {
    if (tokens.length === 0) throw Error("LP failed to provide tokens");
    tokens.forEach(t => this.addToken(t));
  }

  addToken(token: string) {
    this.tokens = Array.from(new Set([...this.tokens, token]));
  }

  async print() {
    for (let i = 0; i < this.tokens.length; i++) {
      let erc20;

      try {
        erc20 = await new ERC20Mock__factory(this.signer).attach(this.tokens[i]);
        console.log("Address: ", erc20.address, "\n Symbol: ", await erc20.symbol());
      } catch {
        erc20 = new Contract(this.tokens[i], symbol, this.signer);
        console.log("Address: ", erc20.address, "\n Symbol: ", await erc20.symbol());
      }
    }
  }
}

async function main() {
  // @ts-ignore
  const signer = await ethers.getSigner();

  const tokens = new UnderlyingTokens(signer);

  const enso = await new EnsoBuilder(signer).mainnet().build();

  const dhedge = await new DHedgeEnvironmentBuilder(signer).connect();

  const indexed = await new IndexedEnvironmentBuilder(signer).connect();

  const powerpool = await new PowerpoolEnvironmentBuilder(signer).connect();

  const piedao = await new PieDaoEnvironmentBuilder(signer).connect();

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
    await tokens.print();
  } catch (e) {
    await tokens.print();
    console.log(e);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
