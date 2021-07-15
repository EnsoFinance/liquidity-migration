//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "./IStrategyRouter.sol";
import "./IStrategyToken.sol";
import "./IOracle.sol";
import "./IRegistry.sol";
import "../helpers/StrategyTypes.sol";

interface IStrategy is IStrategyToken, StrategyTypes {
    function approveToken(
        IERC20 token,
        address account,
        uint256 amount
    ) external;

    function setStructure(Item[] memory newItems) external;

    function withdraw(uint256 amount) external;

    function deposit(
        uint256 amount,
        IStrategyRouter router,
        bytes memory data
    ) external payable;

    function depositFromController(
        address account,
        IStrategyRouter router,
        bytes memory data
    ) external payable returns (uint256);

    function mint(address account, uint256 amount) external;

    function items() external view returns (address[] memory);

    function getCategory(address item) external view returns (ItemCategory);

    function getPercentage(address item) external view returns (uint256);

    function getCache(address item) external view returns (bytes memory);

    function getData(address item) external view returns (ItemData memory);

    function controller() external view returns (address);

    function manager() external view returns (address);

    function oracle() external view returns (IOracle);

    function registry() external view returns (IRegistry);

    function verifyStructure(Item[] memory newItems)
        external
        view
        returns (bool);
}
