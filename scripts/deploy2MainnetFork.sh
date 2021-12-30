#!/bin/bash
# shellcheck disable=SC2164
cd /home/ubuntu/liquidity-migration
yarn
TS_NODE_TRANSPILE_ONLY=1 yarn hardhat typechain
yarn hardhat addOwnerFunds --network localhost
yarn deploy-v2 localhost
yarn hardhat setupMigration --network localhost
yarn hardhat initMasterUser --network localhost
yarn hardhat whitelistMigrationAdapter --network localhost
#yarn hardhat transferOwnership --to '0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F' --network localhost
