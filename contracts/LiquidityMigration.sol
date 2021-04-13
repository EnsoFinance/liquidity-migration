
//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;


// Erc20
import { SafeERC20, IERC20 } from "./ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";

// Enso::Strategy
// interface Strategy {

// }

// PieDao::SmartPoolRegistry
interface PieDaoRegistry {
    function inRegistry(address pool) external view returns (bool);
}

// PieDao::PV2SmartPool
// PieDao::PCappedSmartPool
interface PieDaoSmartPool {
       function exitPool(uint256 _amount) external;
}

contract LiquidityMigration {
    using SafeERC20 for IERC20;

    address immutable public genericRouter;

    enum Protocols { PieDao, dHedge } // Accepted protocols
    mapping(Protocols => address) public protocols; // Protocol => Factory address

    // Liquidity to migrate
    struct Stake {
        uint256 amount;
        address poolToken; // TODO: save to storage or reconstruct event logs? (prove with sha3(sender, token) )
        Protocols protocol;
    }
    mapping(address => mapping (address => Stake)) public stakes;   // stakes[sender][poolToken] = Stake

    constructor(Protocols[] memory protos, address[] memory factories, address _genericRouter) {
        require(protos.length == factories.length, "LM: Inputs different length");
        for (uint256 i = 0; i < protos.length; i++) {
            protocols[protos[i]] = factories[i];
        }
        genericRouter = _genericRouter;
    }

    function stakeLpTokens(
        address poolToken,
        uint256 amount,
        Protocols protocol
    ) public {
        require(protocols[protocol] != address(0), "LM: Protocol not registered");
        require(inRegistry(poolToken, protocol), "LM: Pool not in protocol");
        IERC20(poolToken).safeTransferFrom(msg.sender, address(this), amount);
        Stake storage stake = stakes[msg.sender][poolToken];
        stake.amount += amount;
        stake.protocol = protocol;
        stake.poolToken = poolToken;
    }

    function migrate(
        address ensoStrategy,
        address poolToken,
        Protocols protocol
    ) public {
        require(protocols[protocol] != address(0), "LM: Protocol not registered");
        require(inRegistry(poolToken, protocol), "LM: Pool not in protocol");
        Stake storage stake = stakes[msg.sender][poolToken];
        bytes memory calls = getMigrationData(protocol, msg.sender, poolToken, stake.amount);
        require(IERC20(poolToken).transfer(genericRouter, stake.amount));

        // approve pool token for generic router
        // encode exitPool() call from generic router
        // transfer tokens to new strategy
    }

    function getMigrationData(Protocols protocol, address staker, address pool, uint amount) public view returns (bytes memory calls) {
        if (protocol == Protocols.PieDao) {
            calls = abi.encodeWithSelector(PieDaoSmartPool(pool).exitPool.selector, amount);
        }
    }

    function getStake(address account, address poolToken) public view returns (Stake memory stake) {
        stake = stakes[account][poolToken];
    }

    // function getStake(address account, address poolToken) public view returns (Stake memory stake) {
    //     stake = stakes[keccak256(abi.encodePacked(account, poolToken))];
    // }

    function inRegistry(address poolToken, Protocols protocol) public view returns (bool) {
        if (protocol == Protocols.PieDao) {
            return PieDaoRegistry(protocols[protocol]).inRegistry(poolToken);
        } else {
            // TODO: complete for other protocols
            return false;
        }
    }
}
