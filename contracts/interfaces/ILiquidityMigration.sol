//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface ILiquidityMigration {
    function adapters(address _adapter) external view returns (bool);
    function hasStaked(address _account, address _lp) external view returns (bool);
}
