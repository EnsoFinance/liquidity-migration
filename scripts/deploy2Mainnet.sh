#!/bin/bash
# shellcheck disable=SC2164

yarn deploy-v2 mainnet
yarn hardhat whitelistMigrationAdapter --network mainnet
yarn hardhat transferOwnership --to '0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F' --network mainnet
