//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

interface ILiquidityMigration {
    function hasStaked(address _account, address _lp) external view returns (bool);
}
