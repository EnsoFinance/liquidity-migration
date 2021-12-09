#!/bin/bash
# shellcheck disable=SC2164

yarn deploy mainnet
yarn hardhat addAllAdapters --network mainnet
yarn hardhat whitelistAllStrategies --network mainnet
yarn hardhat transferOwnership --to '0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F' --network mainnet
