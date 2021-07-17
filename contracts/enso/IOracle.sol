//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "./IStrategy.sol";
import "../helpers/StrategyTypes.sol";

interface IOracle is StrategyTypes {
    function weth() external view returns (address);

    function consult(uint256 amount, address input) external view returns (uint256);

    function estimateStrategy(IStrategy strategy) external view returns (uint256, uint256[] memory);

    function estimateItem(
        uint256 balance,
        address token,
        ItemData memory data
    ) external view returns (uint256);

    function estimateTotal(address account, address[] memory tokens)
        external
        view
        returns (uint256, uint256[] memory);
}
