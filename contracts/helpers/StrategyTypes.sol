//SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.2;

interface StrategyTypes {

    enum ItemCategory {NULL, BASIC, STRATEGY, NFT, SYNTH, UNISWAP_V2, UNISWAP_V3, BALANCER, SUSHI, SUSHI_FARM, CURVE, CURVE_GAUGE, AAVE, COMPOUND, YEARN_V1, YEARN_V2}
    enum TimelockCategory {RESTRUCTURE, THRESHOLD, SLIPPAGE, TIMELOCK, PERFORMANCE}

    struct ItemData {
        ItemCategory category;
        uint16 percentage;
        bytes cache;
    }

    struct Item {
        address item;
        ItemData data;
    }

    struct StrategyState {
        uint256 lastTokenValue;
        uint32 timelock;
        uint16 rebalanceThreshold;
        uint16 slippage;
        uint16 performanceFee;
        bool social;
        bool initialized;
    }

    /**
        @notice A time lock requirement for changing the state of this Strategy
        @dev WARNING: Only one TimelockCategory can be pending at a time
    */
    struct Timelock {
        TimelockCategory category;
        uint256 timestamp;
        bytes data;
    }
}
