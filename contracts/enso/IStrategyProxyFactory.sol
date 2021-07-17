//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "../helpers/StrategyTypes.sol";

interface IStrategyProxyFactory is StrategyTypes{
    function createStrategy(
        address manager,
        string memory name,
        string memory symbol,
        StrategyItem[] memory strategyItems,
        StrategyState memory strategyState,
        address router,
        bytes memory data
    ) external payable returns (address);

    function updateProxyVersion(address proxy) external;

    function implementation() external view returns (address);

    function controller() external view returns (address);

    function oracle() external view returns (address);

    function registry() external view returns (address);

    function version() external view returns (string memory);

    function getManager(address proxy) external view returns (address);

    function salt(address manager, string memory name, string memory symbol) external pure returns (bytes32);
}
