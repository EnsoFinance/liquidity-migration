//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

// Erc20
import { SafeERC20, IERC20 } from "./ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import { IAdapter } from "./interfaces/IAdapter.sol";
import "./enso/IStrategyProxyFactory.sol";
import "./enso/IStrategyController.sol";
import "./enso/IStrategy.sol";
import "./helpers/Timelocked.sol";
import "./helpers/StrategyTypes.sol";

contract NewLiquidityMigration is Timelocked, StrategyTypes {
    
    using SafeERC20 for IERC20;
    
    address public generic;
    address public controller;
    IStrategyProxyFactory public factory;
    
    mapping (address => bool) public adapters;
    mapping (address => mapping (address => uint256)) public staked;

    event Staked(address adapter, address strategy, uint256 amount, address account);
    event Migrated(address adapter, address lp, address strategy, address account);
    event Created(address adapter, address strategy, address account);

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
    ) 
        Timelocked(_unlock, _modify, _owner)
    {
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
    ) 
        public
        onlyRegistered(_adapter)
        onlyWhitelisted(_adapter, _lp)
    {
        IERC20(_lp).safeTransferFrom(msg.sender, address(this), _amount);

        staked[msg.sender][_lp] += _amount;
        emit Staked(_adapter, _lp, _amount, msg.sender);
    }

    function migrate(
        address _lp,
        address _adapter,
        IStrategy _strategy,
        bytes memory migrationData
    ) 
        public
        onlyUnlocked
        onlyRegistered(_adapter)
        onlyWhitelisted(_adapter, _lp)
    {
        require(IStrategyController(controller).initialized(address(_strategy)), "NewLiquidityMigration#migrate: not enso strategy");

        uint256 _stake = staked[msg.sender][_lp];
        require(_stake > 0, "NewLiquidityMigration#migrate: not staked");
        
        delete staked[msg.sender][_lp];
        IERC20(_lp).safeTransfer(generic, _stake);

        uint256 _before = _strategy.balanceOf(address(this));
        _strategy.deposit(0, IStrategyRouter(generic), migrationData);
        uint256 _after = _strategy.balanceOf(address(this));
        
        _strategy.transfer(msg.sender, (_after - _before));
        emit Migrated(_adapter, _lp, address(_strategy), msg.sender);
    }


    function creatingStrategy(
        address _lp,
        address _adapter,
        bytes calldata data
    )
        public 
        onlyRegistered(_adapter)
        onlyWhitelisted(_adapter, _lp)
    {
        (
            address manager,
            string memory name,
            string memory symbol,
            Item[] memory strategyItems,
            bool social,
            uint256 fee,
            uint256 threshold,
            uint256 slippage,
            uint256 timelock,
            address router,
            bytes memory data_1
        ) = abi.decode(
            data,
            (
                address, string, string, Item[], bool, uint256, 
                uint256, uint256, uint256, address, bytes
            )
        );
        
        for (uint i = 0; i < strategyItems.length; i++) {
            address tokenAddress = strategyItems[i].item;
            require(IAdapter(_adapter).underlyingTokenInTheLp(_lp)(tokenAddress) == true);
        }
        
        require(strategyItems.length == IAdapter(_adapter).numberOfUnderlyingTokens(_lp));

        address strategy = factory.createStrategy(
            manager, 
            name,  
            symbol,
            strategyItems,
            social,
            fee,
            threshold,
            slippage,
            timelock,
            router,
            data_1
        );
        emit Created(_adapter, strategy, msg.sender);
    }



    // function emergencyDrain() {}

    function updateController(address newController) public onlyOwner {
        controller = newController;
    }
    
    function updateGeneric(address newGeneric) public onlyOwner {
        generic = newGeneric;
    }
    
    function addAdapter(address newAdapter_) public onlyOwner {
        adapters[newAdapter_] = true;
    }
    
    function removeAdapter(address oldAdapter_) public onlyOwner {
        adapters[oldAdapter_] = false;
    }
}

