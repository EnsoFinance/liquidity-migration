//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import { IERC20 } from  "../ecosystem/openzeppelin/token/ERC20/IERC20.sol";

interface IStrategyToken is IERC20 {
    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);
    
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function nonces(address owner) external view returns (uint256);
}
