#!/bin/bash
# shellcheck disable=SC2164
cd /home/ubuntu/liquidity-migration
yarn
yarn hardhat addOwnerFunds --network localhost
yarn deploy localhost
yarn hardhat initMasterUser --network localhost
yarn hardhat whitelistAllStrategies --network localhost
yarn hardhat addAllAdapters --network localhost
