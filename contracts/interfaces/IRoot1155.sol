// SPDX-License-Identifier: WTFPL

pragma solidity ^0.8.0;

import "../ecosystem/openzeppelin/token/ERC1155/IERC1155.sol";

interface IRoot1155 is IERC1155 {
    function getMaxTokenID() external view returns(uint256);
    function burn(address account, uint256 id, uint256 value) external;
}