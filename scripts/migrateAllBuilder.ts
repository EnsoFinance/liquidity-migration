import { Input, Transaction, PoolMapJson } from "../src/types";
import { write2File } from "../src/utils";
import poolsToMigrate from "../out/stakes_to_migrate.json";
import strategiesJSON from "../out/deployed_strategies.json";
const strategies: { [key: string]: string } = strategiesJSON;

const liquidityMigratiionV2 = "0x0c6D898ac945E493D25751Ea43BE2c8Beb881D8C";

const migrateAllInputs: Input[] = [
  { internalType: "address", name: "lp", type: "address" },
  { internalType: "address", name: "adapter", type: "address" },
];

const transactions: Transaction[] = [];
async function main() {
  const lps = Object.keys(strategies);
  const poolsData: PoolMapJson = poolsToMigrate;
  for (let i = 0; i < lps.length; i++) {
    const lp = lps[i];
    const poolData = poolsData[lp];
    if (poolData) {
      const adapter = poolData.adapter;
      const transaction: Transaction = {
        to: liquidityMigratiionV2,
        value: "0",
        data: null,
        contractMethod: {
          inputs: migrateAllInputs,
          name: "migrateAll",
          payable: false,
        },
        contractInputsValues: {
          lp: lp,
          adapter: adapter,
        },
      };
      transactions.push(transaction);
    }
  }
  write2File("migrate_all_transactions.json", transactions);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
