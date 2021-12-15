//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "@enso/contracts/contracts/interfaces/IStrategy.sol";
import "@enso/contracts/contracts/interfaces/IStrategyRouter.sol";
import "../../interfaces/IAdapter.sol";
import "../libraries/SafeERC20Transfer.sol";

interface IMigrationController {
  function migrate(IStrategy strategy, IERC20 lpToken, uint256 amount ) external;

  function finalizeMigration(
      IStrategy strategy,
      IStrategyRouter genericRouter,
      IAdapter migrationAdapter,
      IERC20 lpToken
  ) external;
}
