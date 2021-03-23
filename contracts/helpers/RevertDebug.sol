pragma solidity 0.8.2;
//SPDX-License-Identifier: UNLICENSED
// Original: https://github.com/authereum/contracts/blob/master/contracts/account/BaseAccount.sol
// Author: Authereum Labs, Inc.
contract RevertDebug {
    string public constant CALL_REVERT_PREFIX = "Multicall: ";

    /// @dev Get the revert message from a call
    /// @notice This is needed in order to get the human-readable revert message from a call
    /// @param _res Response of the call
    /// @return Revert message string
    function _getRevertMsgFromRes(bytes memory _res) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_res.length < 68) return "No revert msg";
        return abi.decode(_res, (string)); // All that remains is the revert string
    }

    /// @dev Get the prefixed revert message from a call
    /// @param _res Response of the call
    /// @return Prefixed revert message string
    function _getPrefixedRevertMsg(bytes memory _res) internal pure returns (string memory) {
        string memory _revertMsg = _getRevertMsgFromRes(_res);
        return string(abi.encodePacked(CALL_REVERT_PREFIX, _revertMsg));
    }
}
