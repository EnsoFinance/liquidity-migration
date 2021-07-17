//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface StrategyTypes {

    enum ItemCategory {NULL, BASIC, STRATEGY, NFT, SYNTH, UNISWAP_V2, UNISWAP_V3, BALANCER, SUSHI, SUSHI_FARM, CURVE, CURVE_GAUGE, AAVE, COMPOUND, YEARN_V1, YEARN_V2}
    enum TimelockCategory {RESTRUCTURE, THRESHOLD, SLIPPAGE, TIMELOCK, PERFORMANCE}

    struct StrategyItem {
        address item;
        uint16 percentage;
        ItemCategory category;
        bytes cache;
        address[] adapters;
        address[] path;
    }

    struct Item {
        address item;
        ItemData data;
    }

    struct ItemData {
        ItemCategory category;
        bytes cache;
    }

    struct TradeData {
        address[] adapters;
        address[] path;
    }


    struct StrategyState {
        uint32 timelock;
        uint16 rebalanceThreshold;
        uint16 slippage;
        uint16 performanceFee;
        bool social;
    }

    struct Timelock {
        TimelockCategory category;
        uint256 timestamp;
        bytes data;
    }
}
