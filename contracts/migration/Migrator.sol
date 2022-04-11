pragma solidity >=0.8.0;

import "@ensofinance/v1-core/contracts/interfaces/IStrategy.sol";
import "@ensofinance/v1-core/contracts/interfaces/IStrategyRouter.sol";

contract Migrator {
    function deposit(
        IStrategy,
        IStrategyRouter,
        uint256,
        uint256,
        bytes memory
    ) external {}

    function initialized(address) external view returns (bool) {
        return true;
    }

    function transfer(address, uint256) external view returns (bool) {
        return true;
    }

    function balanceOf(address) external view returns (uint256) {
        return 0;
    }
}
