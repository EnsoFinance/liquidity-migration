//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import { SafeERC20, IERC20 } from "../../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "@enso/contracts/contracts/interfaces/IStrategyController.sol";
import "@enso/contracts/contracts/helpers/StrategyTypes.sol";
import "../../interfaces/IAdapter.sol";
import "../../helpers/Timelocked.sol";
import "../Migrator.sol";

contract MockLiquidityMigration is Migrator, Timelocked, StrategyTypes {
    using SafeERC20 for IERC20;

    address public controller;

    mapping (address => mapping (address => uint256)) public staked;

    event Staked(address adapter, address strategy, uint256 amount, address account);
    event Migrated(address adapter, address lp, address strategy, address account);

    constructor(
        address controller_,
        uint256 _unlock,
        uint256 _modify,
        address _owner
    )
        Timelocked(_unlock, _modify, _owner)
    {
        controller = controller_;
    }
    // For testing, normally would rely on a merkle proof
    function batchSetStake(
        address[] memory _user,
        address[] memory _lp,
        uint256[] memory _stake
    )
        external
        onlyOwner
    {
        require(_user.length == _lp.length);
        require(_user.length == _stake.length);
        for ( uint256 i = 0; i < _user.length; i++ ) {
            staked[_user[i]][_lp[i]] += _stake[i];
            emit Staked(address(0), _lp[i], _stake[i], msg.sender);
        }
    }
    // For testing, normally would rely on a single deposit + merkle proof for claiming
    function batchMigrate(
        address[] memory _user,
        address _lp,
        IStrategy _strategy
    )
        external
        onlyOwner
        onlyUnlocked
    {
        uint256 totalBalance;
        uint256[] memory userBalances = new uint256[](_user.length);
        for (uint256 i = 0; i < _user.length; i++) {
            uint256 userBalance = staked[_user[i]][_lp];
            userBalances[i] = userBalance;
            totalBalance += userBalance;
            delete staked[_user[i]][_lp];
        }
        uint256 strategyBalanceBefore = _strategy.balanceOf(address(this));
        // The following would get refined but it is current written this way
        // to stay compatible with MigrationController
        IAdapter.Call[] memory calls = new IAdapter.Call[](1);
        calls[0] = IAdapter.Call(_lp, new bytes(0));
        bytes memory migrationData = abi.encode(calls);
        IERC20(_lp).safeTransfer(controller, totalBalance);
        IStrategyController(controller).deposit(
            _strategy,
            IStrategyRouter(address(0)),
            0,
            0,
            migrationData
        );
        //////////////////////////////////////////////////////////////////////
        uint256 strategyBalanceAfter = _strategy.balanceOf(address(this));
        assert(strategyBalanceAfter - strategyBalanceBefore == totalBalance);
        for (uint256 i = 0; i < userBalances.length; i++) {
            _strategy.transfer(_user[i], userBalances[i]);
            Migrated(address(0), _lp, address(_strategy), _user[i]);
        }
    }

    function hasStaked(address _account, address _lp)
        external
        view
        returns(bool)
    {
        return staked[_account][_lp] > 0;
    }
}
