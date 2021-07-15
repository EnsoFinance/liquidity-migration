//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

// Erc20
import { SafeERC20, IERC20 } from "./ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import { IAdapter } from "./interfaces/IAdapter.sol";

// TODO: Make external adapters? vs Store individual pools vs Verify pool in registry
contract LiquidityMigration {
    using SafeERC20 for IERC20;

    enum AcceptedProtocols {
        PieDao,
        DPI,
        TokenSets
    } // Accepted protocols

    struct EnsoContracts {
        address genericRouter;
        address strategyController;
    }

    // External strategy tokens
    struct Stake {
        uint256 amount;
        address strategyToken; // TODO: save to storage or reconstruct event logs? (prove with sha3(sender, token) )
        AcceptedProtocols protocol;
    }

    struct Adapters {
        AcceptedProtocols protocol;
        address adapter;
    }

    EnsoContracts public ensoContracts;
    mapping(address => mapping(address => Stake)) public stakes; // stakes[sender][strategyToken] = Stake
    mapping(AcceptedProtocols => address) public adapters;

    constructor(Adapters[] memory acceptedAdapters, EnsoContracts memory contracts) {
        for (uint256 i = 0; i < acceptedAdapters.length; i++) {
            adapters[acceptedAdapters[i].protocol] = acceptedAdapters[i].adapter;
        }
        ensoContracts = contracts;
    }

    function stakeLpTokens(
        address strategyToken,
        uint256 amount,
        AcceptedProtocols protocol
    ) public {
        IAdapter adapter = IAdapter(adapters[protocol]);
        require(address(adapter) != address(0), "LM: Protocol not registered");
        require(adapter.isWhitelisted(strategyToken), "LM: Pool not in protocol");
        IERC20(strategyToken).safeTransferFrom(msg.sender, address(this), amount);
        Stake storage stake = stakes[msg.sender][strategyToken];
        stake.amount += amount;
        stake.protocol = protocol;
        stake.strategyToken = strategyToken;
    }

    function migrate(
        address ensoStrategy,
        address strategyToken,
        AcceptedProtocols protocol,
        bytes memory migrationData,
        uint256 minimumAmount
    ) public {
        IAdapter adapter = IAdapter(adapters[protocol]);
        require(address(adapter) != address(0), "LM: Protocol not registered");
        require(adapter.isWhitelisted(strategyToken), "LM: Pool not in protocol");
        EnsoStrategy enso = EnsoStrategy(ensoStrategy);
        require(enso.controller() == ensoContracts.strategyController, "Not Enso strategy");
        uint256 balanceBefore = IERC20(ensoStrategy).balanceOf(address(this));
        Stake storage stake = stakes[msg.sender][strategyToken];
        require(stake.strategyToken == strategyToken, "Wrong token");
        uint256 stakeAmount = stake.amount;
        delete stakes[msg.sender][strategyToken];
        IERC20(strategyToken).safeTransfer(ensoContracts.genericRouter, stakeAmount);
        // TODO: verify it is an enso strategy
        StrategyController(ensoContracts.strategyController).deposit(
            EnsoStrategy(ensoStrategy),
            IStrategyRouter(ensoContracts.genericRouter),
            migrationData
        );
        uint256 balanceAfter = IERC20(ensoStrategy).balanceOf(address(this));
        require(balanceAfter > balanceBefore, "Didnt receive Enso strategy tokens");
        uint256 gained = balanceAfter - balanceBefore;
        require(gained > minimumAmount, "Didnt receive enough Enso strategy tokens");
        IERC20(ensoStrategy).safeTransfer(msg.sender, balanceAfter - balanceBefore);
    }

    function getStake(address account, address strategyToken) public view returns (Stake memory stake) {
        stake = stakes[account][strategyToken];
    }
}

// Enso::StrategyController
interface StrategyController {
    function deposit(
        EnsoStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external payable;
}

// TODO: does the external contract use the provided ABI or it's local version
interface IStrategyRouter {
    function sellTokens(
        address strategy,
        address[] memory tokens,
        address[] memory routers
    ) external;

    function buyTokens(
        address strategy,
        address[] memory tokens,
        address[] memory routers
    ) external;

    function deposit(address strategy, bytes calldata data) external;

    function controller() external view returns (address);

    function weth() external view returns (address);
}

// Enso::Strategy
interface EnsoStrategy {
    function approveTokens(address account, uint256 amount) external;

    function setStructure(address[] memory newItems, uint256[] memory newPercentages) external;

    function withdraw(uint256 amount) external;

    function mint(address account, uint256 amount) external;

    function items() external view returns (address[] memory);

    function percentage(address token) external view returns (uint256);

    function isWhitelisted(address account) external view returns (bool);

    function controller() external view returns (address);

    function manager() external view returns (address);

    function oracle() external view returns (address);

    function whitelist() external view returns (address);

    function verifyStructure(address[] memory newTokens, uint256[] memory newPercentages) external pure returns (bool);
}
