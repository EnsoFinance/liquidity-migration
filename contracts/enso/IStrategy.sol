//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import { IERC20, IStrategyToken } from "./IStrategyToken.sol";

interface IStrategy is IStrategyToken {
    function approveToken(
        IERC20 token,
        address account,
        uint256 amount
    ) external;

    function approveTokens(address account, uint256 amount) external;

    function setStructure(address[] memory newItems, uint256[] memory newPercentages) external;

    function withdraw(uint256 amount) external;

    function mint(address account, uint256 amount) external;

    function updateManager(address newManager) external;

    function items() external view returns (address[] memory);

    function percentage(address token) external view returns (uint256);

    function isWhitelisted(address account) external view returns (bool);

    function controller() external view returns (address);

    function manager() external view returns (address);

    function oracle() external view returns (address);

    function whitelist() external view returns (address);

    function verifyStructure(address[] memory newTokens, uint256[] memory newPercentages) external pure returns (bool);
}
