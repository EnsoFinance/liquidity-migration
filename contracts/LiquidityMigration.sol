//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.0;

import { SafeERC20, IERC20 } from "./ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAdapter.sol";
import "@ensofinance/v1-core/contracts/interfaces/IStrategyProxyFactory.sol";
import "@ensofinance/v1-core/contracts/interfaces/IStrategyController.sol";
import "@ensofinance/v1-core/contracts/helpers/StrategyTypes.sol";
import "./helpers/Timelocked.sol";

import "hardhat/console.sol";

contract LiquidityMigration is Timelocked, StrategyTypes {
    using SafeERC20 for IERC20;

    address public generic;
    address public controller;
    IStrategyProxyFactory public factory;

    mapping(address => bool) public adapters;
    mapping(address => uint256) public stakedCount;
    mapping(address => mapping(address => uint256)) public staked;
    mapping(address => bool) private _tempIsUnderlying;

    event Staked(address adapter, address strategy, uint256 amount, address account);
    event Migrated(address adapter, address lp, address strategy, address account);
    event Created(address adapter, address lp, address strategy, address account);
    event Refunded(address lp, uint256 amount, address account);

    /**
     * @dev Require adapter registered
     */
    modifier onlyRegistered(address _adapter) {
        require(adapters[_adapter], "Claimable#onlyState: not registered adapter");
        _;
    }

    /**
     * @dev Require adapter allows lp
     */
    modifier onlyWhitelisted(address _adapter, address _lp) {
        require(IAdapter(_adapter).isWhitelisted(_lp), "Claimable#onlyState: not whitelisted strategy");
        _;
    }

    constructor(
        address[] memory adapters_,
        address generic_,
        IStrategyProxyFactory factory_,
        address controller_,
        uint256 _unlock,
        uint256 _modify,
        address _owner
    ) Timelocked(_unlock, _modify, _owner) {
        for (uint256 i = 0; i < adapters_.length; i++) {
            adapters[adapters_[i]] = true;
        }
        generic = generic_;
        factory = factory_;
        controller = controller_;
    }

    function stake(
        address _lp,
        uint256 _amount,
        address _adapter
    ) public {
        IERC20(_lp).safeTransferFrom(msg.sender, address(this), _amount);
        _stake(_lp, _amount, _adapter);
    }

    function buyAndStake(
        address _lp,
        address _adapter,
        address _exchange,
        uint256 _minAmountOut,
        uint256 _deadline
    ) external payable {
        _buyAndStake(_lp, msg.value, _adapter, _exchange, _minAmountOut, _deadline);
    }

    function batchStake(
        address[] memory _lp,
        uint256[] memory _amount,
        address[] memory _adapter
    ) external {
        require(_lp.length == _amount.length, "LiquidityMigration#batchStake: not same length");
        require(_amount.length == _adapter.length, "LiquidityMigration#batchStake: not same length");

        for (uint256 i = 0; i < _lp.length; i++) {
            stake(_lp[i], _amount[i], _adapter[i]);
        }
    }

    function batchBuyAndStake(
        address[] memory _lp,
        uint256[] memory _amount,
        address[] memory _adapter,
        address[] memory _exchange,
        uint256[] memory _minAmountOut,
        uint256 _deadline
    ) external payable {
        require(_amount.length == _lp.length, "LiquidityMigration#batchBuyAndStake: not same length");
        require(_adapter.length == _lp.length, "LiquidityMigration#batchBuyAndStake: not same length");
        require(_exchange.length == _lp.length, "LiquidityMigration#batchBuyAndStake: not same length");
        require(_minAmountOut.length == _lp.length, "LiquidityMigration#batchBuyAndStake: not same length");

        uint256 total = 0;
        for (uint256 i = 0; i < _lp.length; i++) {
            total = total + _amount[i];
            _buyAndStake(_lp[i], _amount[i], _adapter[i], _exchange[i], _minAmountOut[i], _deadline);
        }
        require(msg.value == total, "LiquidityMigration#batchBuyAndStake: incorrect amounts");
    }

    function migrate(
        address _lp,
        address _adapter,
        IStrategy _strategy,
        uint256 _slippage
    ) external onlyUnlocked {
        console.log("debug liquidityMigration: migrate start");
        _migrate(msg.sender, _lp, _adapter, _strategy, _slippage);
    }

    function migrate(
        address _user,
        address _lp,
        address _adapter,
        IStrategy _strategy,
        uint256 _slippage
    ) external onlyOwner onlyUnlocked {
        _migrate(_user, _lp, _adapter, _strategy, _slippage);
    }

    function batchMigrate(
        address[] memory _lp,
        address[] memory _adapter,
        IStrategy[] memory _strategy,
        uint256[] memory _slippage
    ) external onlyUnlocked {
        require(_lp.length == _adapter.length);
        require(_adapter.length == _strategy.length);

        for (uint256 i = 0; i < _lp.length; i++) {
            _migrate(msg.sender, _lp[i], _adapter[i], _strategy[i], _slippage[i]);
        }
    }

    function batchMigrate(
        address[] memory _user,
        address[] memory _lp,
        address[] memory _adapter,
        IStrategy[] memory _strategy,
        uint256[] memory _slippage
    ) external onlyOwner onlyUnlocked {
        require(_user.length == _lp.length);
        require(_lp.length == _adapter.length);
        require(_adapter.length == _strategy.length);

        for (uint256 i = 0; i < _lp.length; i++) {
            _migrate(_user[i], _lp[i], _adapter[i], _strategy[i], _slippage[i]);
        }
    }

    function refund(address _user, address _lp) public onlyOwner {
        _refund(_user, _lp);
    }

    function batchRefund(address[] memory _users, address _lp) public onlyOwner {
        for (uint256 i = 0; i < _users.length; i++) {
            _refund(_users[i], _lp);
        }
    }

    function _refund(address _user, address _lp) internal {
        uint256 _amount = staked[_user][_lp];
        require(_amount > 0, "LiquidityMigration#_refund: no stake");
        delete staked[_user][_lp];

        IERC20(_lp).safeTransfer(_user, _amount);
        emit Refunded(_lp, _amount, _user);
    }

    function _migrate(
        address _user,
        address _lp,
        address _adapter,
        IStrategy _strategy,
        uint256 _slippage
    ) internal onlyRegistered(_adapter) onlyWhitelisted(_adapter, _lp) {
        console.log("debug: _migrate start");
        require(
            IStrategyController(controller).initialized(address(_strategy)),
            "LiquidityMigration#_migrate: not enso strategy"
        );

        uint256 _stakeAmount = staked[_user][_lp];
        require(_stakeAmount > 0, "LiquidityMigration#_migrate: not staked");

        console.log("debug: _migrate 0");
        delete staked[_user][_lp];
        IERC20(_lp).safeTransfer(generic, _stakeAmount);

        console.log("debug: _migrate 1");
        uint256 _before = _strategy.balanceOf(address(this));
        bytes memory migrationData = abi.encode(
            IAdapter(_adapter).encodeMigration(generic, address(_strategy), _lp, _stakeAmount)
        );

        console.log("debug: _migrate 2");
        console.log(controller);
        console.log(generic);
        console.log(_slippage);
        //console.log(migrationData);
        IStrategyController(controller).deposit(_strategy, IStrategyRouter(generic), 0, _slippage, migrationData);
        console.log("debug: 2.5");
        uint256 _after = _strategy.balanceOf(address(this));

        console.log("debug: _migrate 3");
        _strategy.transfer(_user, (_after - _before));
        emit Migrated(_adapter, _lp, address(_strategy), _user);
    }

    function _stake(
        address _lp,
        uint256 _amount,
        address _adapter
    ) internal onlyRegistered(_adapter) onlyWhitelisted(_adapter, _lp) {
        staked[msg.sender][_lp] += _amount;
        stakedCount[_adapter] += 1;
        emit Staked(_adapter, _lp, _amount, msg.sender);
    }

    function _buyAndStake(
        address _lp,
        uint256 _amount,
        address _adapter,
        address _exchange,
        uint256 _minAmountOut,
        uint256 _deadline
    ) internal {
        uint256 balanceBefore = IERC20(_lp).balanceOf(address(this));
        IAdapter(_adapter).buy{ value: _amount }(_lp, _exchange, _minAmountOut, _deadline);
        uint256 amountAdded = IERC20(_lp).balanceOf(address(this)) - balanceBefore;
        _stake(_lp, amountAdded, _adapter);
    }

    function createStrategy(
        address _lp,
        address _adapter,
        bytes calldata data
    ) public onlyRegistered(_adapter) onlyWhitelisted(_adapter, _lp) {
        (, , , StrategyItem[] memory strategyItems, , , ) = abi.decode(
            data,
            (address, string, string, StrategyItem[], InitialState, address, bytes)
        );
        _validateItems(_adapter, _lp, strategyItems);
        address strategy = _createStrategy(data);
        emit Created(_adapter, _lp, strategy, msg.sender);
    }

    function updateController(address _controller) external onlyOwner {
        require(controller != _controller, "LiquidityMigration#updateController: already exists");
        controller = _controller;
    }

    function updateGeneric(address _generic) external onlyOwner {
        require(generic != _generic, "LiquidityMigration#updateGeneric: already exists");
        generic = _generic;
    }

    function updateFactory(address _factory) external onlyOwner {
        require(factory != IStrategyProxyFactory(_factory), "LiquidityMigration#updateFactory: already exists");
        factory = IStrategyProxyFactory(_factory);
    }

    function addAdapter(address _adapter) external onlyOwner {
        require(!adapters[_adapter], "LiquidityMigration#updateAdapter: already exists");
        adapters[_adapter] = true;
    }

    function removeAdapter(address _adapter) external onlyOwner {
        require(adapters[_adapter], "LiquidityMigration#updateAdapter: does not exist");
        adapters[_adapter] = false;
    }

    function hasStaked(address _account, address _lp) external view returns (bool) {
        return staked[_account][_lp] > 0;
    }

    function getStakeCount(address _adapter) external view returns (uint256) {
        return stakedCount[_adapter];
    }

    function _validateItems(
        address adapter,
        address lp,
        StrategyItem[] memory strategyItems
    ) private {
        address[] memory underlyingTokens = IAdapter(adapter).outputTokens(lp);
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            _tempIsUnderlying[underlyingTokens[i]] = true;
        }
        uint256 total = strategyItems.length;
        for (uint256 i = 0; i < strategyItems.length; i++) {
            // Strategies may have reserve tokens (such as weth) that don't have value
            // So we must be careful not to invalidate a strategy for having them
            if (!_tempIsUnderlying[strategyItems[i].item]) {
                if (strategyItems[i].percentage == 0) {
                    total--;
                } else {
                    revert("LiquidityMigration#createStrategy: incorrect length");
                }
            } else {
                // Otherwise just remove the cached bool after we've checked it
                delete _tempIsUnderlying[strategyItems[i].item];
            }
        }
        // If there are some cached bools that have not been deleted then this check will cause a revert
        require(total == underlyingTokens.length, "LiquidityMigration#createStrategy: does not exist");
    }

    function _createStrategy(bytes memory data) private returns (address) {
        (
            address manager,
            string memory name,
            string memory symbol,
            StrategyItem[] memory strategyItems,
            InitialState memory strategyState,
            address router,
            bytes memory depositData
        ) = abi.decode(data, (address, string, string, StrategyItem[], InitialState, address, bytes));
        return factory.createStrategy(manager, name, symbol, strategyItems, strategyState, router, depositData);
    }
}
