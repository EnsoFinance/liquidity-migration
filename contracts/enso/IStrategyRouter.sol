//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

interface IStrategyRouter {

    function sellTokens(
        address strategy,
        address[] memory tokens,
        address[] memory routers
    ) external;

    function buyTokens(
        address strategy,
        address[] memory tokens,
        address[] memory routers
    ) external;

    function rebalance(address strategy, bytes calldata data) external;

    function deposit(address strategy, bytes calldata data) external;

    function controller() external view returns (address);

    function weth() external view returns (address);
}
