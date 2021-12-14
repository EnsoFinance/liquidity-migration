//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@enso/contracts/contracts/StrategyControllerStorage.sol";
import "@enso/contracts/contracts/interfaces/IStrategy.sol";
import "@enso/contracts/contracts/interfaces/IStrategyRouter.sol";
import "@enso/contracts/contracts/interfaces/IOracle.sol";
import "@enso/contracts/contracts/interfaces/registries/ITokenRegistry.sol";
import "@enso/contracts/contracts/helpers/StrategyTypes.sol";
import "../interfaces/IAdapter.sol";
import "./SafeERC20Transfer.sol";
import "./SignedSafeMath.sol";

// Acts as "generic" address in LiquidityMigration contract
contract MigrationController is StrategyTypes, StrategyControllerStorage {
  using SafeERC20Transfer for IERC20;
  using SignedSafeMath for int256;

  uint256 private constant DIVISOR = 1000;
  int256 private constant PERCENTAGE_BOUND = 10000; // Max 10x leverage

  address internal immutable _liquidityMigration;
  address internal immutable _ensoManager;

  event Withdraw(address indexed strategy, address indexed account, uint256 value, uint256 amount);
  event Deposit(address indexed strategy, address indexed account, uint256 value, uint256 amount);
  event Balanced(address indexed strategy, uint256 total);
  event NewStructure(address indexed strategy, StrategyItem[] items, bool indexed finalized);
  event NewValue(address indexed strategy, TimelockCategory category, uint256 newValue, bool indexed finalized);
  event StrategyOpen(address indexed strategy, uint256 performanceFee);
  event StrategySet(address indexed strategy);

  constructor(address liquidityMigration, address ensoManager) public {
      _liquidityMigration = liquidityMigration;
      _ensoManager = ensoManager;
  }

  function deposit(
      IStrategy strategy,
      IStrategyRouter,
      uint256,
      uint256,
      bytes memory data
  ) external {
      require(msg.sender == _liquidityMigration, "Wrong sender");
      (IAdapter.Call[] memory calls) = abi.decode(data, (IAdapter.Call[]));
      IERC20 lpToken = IERC20(calls[0].target); // MockAdapter encodes lp here
      // Funds were sent to generic router, which this address is set as in LiquidityMigration
      uint256 depositBalance = lpToken.balanceOf(address(this));
      // Transfer tokens to strategy
      lpToken.safeTransfer(address(strategy), depositBalance);
      // Mint strategy tokens for an equal amount
      strategy.mint(msg.sender, depositBalance);
  }

  function finalizeMigration(
      IStrategy strategy,
      IStrategyRouter genericRouter,
      IAdapter migrationAdapter,
      IERC20 lpToken
  ) external {
      require(msg.sender == _ensoManager, "Wrong sender");
      uint256 balance = lpToken.balanceOf(address(strategy));
      require(balance > 0, "Wrong LP");
      strategy.approveToken(address(lpToken), address(this), balance);
      lpToken.safeTransferFrom(address(strategy), address(genericRouter), balance);
      bytes memory migrationData =
          abi.encode(migrationAdapter.encodeMigration(address(genericRouter), address(strategy), address(lpToken), balance));
      genericRouter.deposit(address(strategy), migrationData);
  }

  function setupStrategy(
      address creator_,
      address strategy_,
      InitialState memory state_,
      address,
      bytes memory
  ) external payable {
      IStrategy strategy = IStrategy(strategy_);
      _setStrategyLock(strategy);
      require(msg.value == 0, "No deposits");
      require(msg.sender == _factory, "Not factory");
      require(creator_ == _ensoManager, "Not enso");
      _setInitialState(strategy_, state_);
      _removeStrategyLock(strategy);
  }

  function verifyStructure(address strategy, StrategyItem[] memory newItems)
      public
      view
      returns (bool)
  {
      require(newItems.length > 0, "Cannot set empty structure");
      require(newItems[0].item != address(0), "Invalid item addr"); //Everything else will caught by the ordering requirement below
      require(newItems[newItems.length-1].item != address(-1), "Invalid item addr"); //Reserved space for virtual item

      ITokenRegistry registry = oracle().tokenRegistry();

      int256 total = 0;
      for (uint256 i = 0; i < newItems.length; i++) {
          address item = newItems[i].item;
          require(i == 0 || newItems[i].item > newItems[i - 1].item, "Item ordering");
          int256 percentage = newItems[i].percentage;
          if (ItemCategory(registry.itemCategories(item)) == ItemCategory.DEBT) {
            require(percentage <= 0, "Debt cannot be positive");
            require(percentage >= -PERCENTAGE_BOUND, "Out of bounds");
          } else {
            require(percentage >= 0, "Token cannot be negative");
            require(percentage <= PERCENTAGE_BOUND, "Out of bounds");
          }
          EstimatorCategory category = EstimatorCategory(registry.estimatorCategories(item));
          require(category != EstimatorCategory.BLOCKED, "Token blocked");
          if (category == EstimatorCategory.STRATEGY)
              _checkCyclicDependency(strategy, IStrategy(item), registry);
          total = total.add(percentage);
      }
      require(total == int256(DIVISOR), "Total percentage wrong");
      return true;
  }

  function initialized(address strategy) external view returns (bool) {
      return _initialized[strategy] > 0;
  }

  function oracle() public view returns (IOracle) {
      return IOracle(_oracle);
  }

  function _setInitialState(address strategy, InitialState memory state) private {
      _checkAndEmit(strategy, TimelockCategory.THRESHOLD, uint256(state.rebalanceThreshold), true);
      _checkAndEmit(strategy, TimelockCategory.REBALANCE_SLIPPAGE, uint256(state.rebalanceSlippage), true);
      _checkAndEmit(strategy, TimelockCategory.RESTRUCTURE_SLIPPAGE, uint256(state.restructureSlippage), true);
      _initialized[strategy] = 1;
      _strategyStates[strategy] = StrategyState(
        state.timelock,
        state.rebalanceSlippage,
        state.restructureSlippage,
        state.social,
        state.set
      );
      IStrategy(strategy).updateRebalanceThreshold(state.rebalanceThreshold);
      if (state.social) {
        _checkDivisor(uint256(state.performanceFee));
        IStrategy(strategy).updatePerformanceFee(state.performanceFee);
        emit StrategyOpen(strategy, state.performanceFee);
      }
      if (state.set) emit StrategySet(strategy);
      emit NewValue(strategy, TimelockCategory.TIMELOCK, uint256(state.timelock), true);
  }

  function _checkCyclicDependency(address test, IStrategy strategy, ITokenRegistry registry) private view {
      require(address(strategy) != test, "Cyclic dependency");
      require(!strategy.supportsSynths(), "Synths not supported");
      address[] memory strategyItems = strategy.items();
      for (uint256 i = 0; i < strategyItems.length; i++) {
        if (EstimatorCategory(registry.estimatorCategories(strategyItems[i])) == EstimatorCategory.STRATEGY)
            _checkCyclicDependency(test, IStrategy(strategyItems[i]), registry);
      }
  }

  function _checkDivisor(uint256 value) private pure {
      require(value <= DIVISOR, "Out of bounds");
  }

  function _checkAndEmit(address strategy, TimelockCategory category, uint256 value, bool finalized) private {
      _checkDivisor(value);
      emit NewValue(strategy, category, value, finalized);
  }

  function _setStrategyLock(IStrategy strategy) private {
      strategy.lock();
  }

  function _removeStrategyLock(IStrategy strategy) private {
      strategy.unlock();
  }
}
