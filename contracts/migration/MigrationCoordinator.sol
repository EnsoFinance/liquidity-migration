pragma solidity >=0.8.0;



import "../helpers/Ownable.sol";
import "./Migrator.sol";
import "./interfaces/ILiquidityMigrationV2.sol";

interface ILiquidityMigrationV1 {
    function migrate(
        address user,
        address lp,
        address adapter,
        address strategy,
        uint256 slippage
    ) external;

    function refund(address user, address lp) external;

    function addAdapter(address adapter) external;

    function updateController(address newController) external;

    function updateGeneric(address newGeneric) external;

    function updateUnlock(uint256 newUnlock) external;

    function transferOwnership(address newOwner) external;

    function staked(address user, address lp) external view returns (uint256);

    function controller() external view returns (address);
}

contract MigrationCoordinator is Migrator, Ownable{
    ILiquidityMigrationV1 public immutable liquidityMigrationV1;
    ILiquidityMigrationV2 public immutable liquidityMigrationV2;
    address public immutable migrationAdapter;

    constructor(
        address liquidityMigrationV1_,
        address liquidityMigrationV2_,
        address migrationAdapter_
    ) public {
        _setOwner(msg.sender);
        liquidityMigrationV1 = ILiquidityMigrationV1(liquidityMigrationV1_);
        liquidityMigrationV2 = ILiquidityMigrationV2(liquidityMigrationV2_);
        migrationAdapter = migrationAdapter_;
    }

    function initiateMigration() external onlyOwner {
        // This adapter does nothing, just returns empty Call[] array
        liquidityMigrationV1.addAdapter(migrationAdapter);
        // Generic receives funds, we want LiquidityMigrationV2 to receive the funds
        liquidityMigrationV1.updateGeneric(address(liquidityMigrationV2));
        // If controller is not zero address, set to zero address
        // Don't want anyone calling migrate until process is complete
        if (liquidityMigrationV1.controller() != address(0))
          liquidityMigrationV1.updateController(address(0));
        // Finally, unlock the migration contract
        liquidityMigrationV1.updateUnlock(block.timestamp);
    }

    function migrateLP(address[] memory users, address lp, address adapter) external onlyOwner {
        // Set controller to allow migration
        liquidityMigrationV1.updateController(address(this));
        // Migrate liquidity for all users passed in array
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            // Get the staked amount as it gets deleted during migration
            uint256 staked = liquidityMigrationV1.staked(user, lp);
            // Migrate the LP tokens
            liquidityMigrationV1.migrate(user, lp, migrationAdapter, address(this), 0);
            // Update the staked amount on the new contract
            liquidityMigrationV2.setStake(user, lp, adapter, staked);
        }
        // Remove controller to prevent further migration
        liquidityMigrationV1.updateController(address(0));
    }

    // Allow users to withdraw from LiquidityMigrationV1
    function withdraw(address lp) external {
        liquidityMigrationV1.refund(msg.sender, lp);
    }

    // Refund wrapper since MigrationCoordinator is now owner of LiquidityMigrationV1
    function refund(address user, address lp) external onlyOwner {
      liquidityMigrationV1.refund(user, lp);
    }

    function transferLiquidityMigrationOwnership(address newOwner) external onlyOwner {
        liquidityMigrationV1.transferOwnership(newOwner);
    }
}
