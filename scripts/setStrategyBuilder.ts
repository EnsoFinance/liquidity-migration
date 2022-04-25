import { Input, Transaction } from "../src/types";
import { write2File } from "../src/utils";
import strategiesJSON from "../out/deployed_strategies.json";
const strategies: { [key: string]: string } = strategiesJSON;

const liquidityMigratiionV2 = "0x0c6D898ac945E493D25751Ea43BE2c8Beb881D8C";

const setStrategyInputs: Input[] = [
  { internalType: "address", name: "lp", type: "address" },
  { internalType: "address", name: "strategy", type: "address" },
];

const transactions: Transaction[] = [];
async function main() {
  const lps = Object.keys(strategies);
  for (let i = 0; i < lps.length; i++) {
    const lp = lps[i];
    const strategy = strategies[lp];
    const transaction: Transaction = {
      to: liquidityMigratiionV2,
      value: "0",
      data: null,
      contractMethod: {
        inputs: setStrategyInputs,
        name: "setStrategy",
        payable: false,
      },
      contractInputsValues: {
        lp: lp,
        strategy: strategy,
      },
    };
    transactions.push(transaction);
  }
  write2File("set_strategy_transactions.json", transactions);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
