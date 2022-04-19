//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "@ensofinance/v1-core/contracts/interfaces/IStrategy.sol";
import "@ensofinance/v1-core/contracts/interfaces/IStrategyRouter.sol";
import "@ensofinance/v1-core/contracts/interfaces/IOracle.sol";
import "@ensofinance/v1-core/contracts/interfaces/IWhitelist.sol";
import "../../interfaces/IAdapter.sol";
import "../libraries/SafeERC20Transfer.sol";

interface IMigrationController {
    function migrate(
        IStrategy strategy,
        IStrategyRouter genericRouter,
        IERC20 lpToken,
        IAdapter adapter,
        uint256 amount
    ) external;

    function initialized(address strategy) external view returns (bool);

    function oracle() external view returns (IOracle);

    function whitelist() external view returns (IWhitelist);
}
