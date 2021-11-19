import hre from "hardhat";
import { ethers } from "hardhat";
import { LP_TOKEN_WHALES } from "../tasks/initMasterUser";
import { DHedgeEnvironmentBuilder } from "../src/dhedge";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { PowerpoolEnvironmentBuilder } from "../src/powerpool";

class UnderlyingTokens {
  tokens: string[];

  constructor() {
    this.tokens = [];
  }

  addTokens(tokens: string[]) {
    if (tokens.length === 0) throw Error("LP failed to provide tokens");
    tokens.forEach(t => this.addToken(t));
  }

  addToken(token: string) {
    this.tokens = Array.from(new Set([...this.tokens, token]));
  }

  print() {
    console.log(this.tokens);
  }
}

async function main() {
  const tokens = new UnderlyingTokens();
  // @ts-ignore
  const signer = await ethers.getSigner();

  const dhedge = await new DHedgeEnvironmentBuilder(signer).connect();
  const indexed = await new IndexedEnvironmentBuilder(signer).connect();
  const powerpool = await new PowerpoolEnvironmentBuilder(signer).connect();

  for (const { victim, lpTokenAddress } of LP_TOKEN_WHALES) {
    switch (victim.toLowerCase()) {
      case "dhedge":
        console.log("getting dhedge tokens ");
        tokens.addTokens(await dhedge.adapter.outputTokens(lpTokenAddress));

      case "powerpool":
        console.log("getting powerpool tokens at: ", lpTokenAddress);
        tokens.addTokens(await powerpool.adapter.outputTokens(lpTokenAddress));

      case "indexed":
        console.log("getting indexed tokens at: ", lpTokenAddress)
        tokens.addTokens(await indexed.adapter.outputTokens(lpTokenAddress));
    }
  }

  tokens.print();
}

main().then(r => console.log(r));
