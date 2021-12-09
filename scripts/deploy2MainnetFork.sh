#!/bin/bash
# shellcheck disable=SC2164
cd /home/ubuntu/liquidity-migration
yarn
yarn hardhat addOwnerFunds --network localhost
yarn deploy localhost
yarn hardhat initMasterUser --network localhost
yarn hardhat addAllAdapters --network localhost
yarn hardhat whitelistAllStrategies --network localhost
yarn hardhat transferOwnership --to '0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F' --network localhost
