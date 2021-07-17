//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "./IStrategy.sol";
import "./IStrategyRouter.sol";
import "./IOracle.sol";
import "./IRegistry.sol";
import "../helpers/StrategyTypes.sol";

interface IStrategyController is StrategyTypes {
    function setupStrategy(
        address manager_,
        address strategy_,
        StrategyState memory state_,
        bytes memory data_
    ) external payable;

    function rebalance(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external;

    function restructure(
        IStrategy strategy,
        Item[] memory strategyItems
    ) external;

    function finalizeStructure(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external;

    function updateValue(
        IStrategy strategy,
        TimelockCategory category,
        uint256 newValue
    ) external;

    function finalizeValue(address strategy) external;

    function withdrawPerformanceFee(IStrategy strategy) external;

    function openStrategy(IStrategy strategy, uint256 fee) external;

    function initialized(address strategy) external view returns (bool);

    function social(address strategy) external view returns (bool);

    function rebalanceThreshold(address strategy) external view returns (uint256);

    function slippage(address strategy) external view returns (uint256);

    function timelock(address strategy) external view returns (uint256);

    function performanceFee(address strategy) external view returns (uint256);

    function oracle() external view returns (IOracle);

    function registry() external view returns (IRegistry);
}
