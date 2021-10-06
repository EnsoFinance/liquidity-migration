#!/bin/bash
# shellcheck disable=SC2164
cd /home/ubuntu/liquidity-migration
yarn
yarn hardhat addOwnerFunds --network localhost
yarn hardhat initMasterUser --network localhost
yarn deploy localhost
