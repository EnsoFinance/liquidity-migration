//SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

// Erc20
import { SafeERC20, IERC20 } from "./ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";

// PieDao::SmartPoolRegistry
interface PieDaoRegistry {
    function inRegistry(address pool) external view returns (bool);
}

contract LiquidityMigration {
    using SafeERC20 for IERC20;

    enum Protocols { PieDao, dHedge } // Accepted protocols
    mapping(Protocols => address) public protocols; // Protocol => Factory address

    // Liquidity to migrate
    struct Stake {
        uint256 amount;
        address poolToken; // TODO: save to storage or reconstruct event logs? (prove with sha3(sender, token))
        Protocols protocol;
    }
    mapping(bytes32 => Stake) public stakes;

    constructor(Protocols[] memory protos, address[] memory factories) {
        require(protos.length == factories.length, "LM: Inputs different length");
        for (uint256 i = 0; i < protos.length; i++) {
            protocols[protos[i]] = factories[i];
        }
    }

    function stakeLpTokens(
        address sender,
        address poolToken,
        uint256 amount,
        Protocols protocol
    ) public {
        require(protocols[protocol] != address(0), "LM: Protocol not registered");
        require(inRegistry(poolToken, protocol), "LM: Pool not in protocol");
        IERC20(poolToken).safeTransferFrom(sender, address(this), amount);
        Stake storage stake = stakes[keccak256(abi.encodePacked(sender, poolToken))];
        stake.amount += amount;
        stake.protocol = protocol;
        stake.poolToken = poolToken;
    }

    function getStake(address account, address poolToken) public view returns (Stake memory stake) {
        stake = stakes[keccak256(abi.encodePacked(account, poolToken))];
    }

    function inRegistry(address poolToken, Protocols protocol) public view returns (bool) {
        if (protocol == Protocols.PieDao) {
            return PieDaoRegistry(protocols[protocol]).inRegistry(poolToken);
        } else {
            // TODO: complete for other protocols
            return false;
        }
    }
}
