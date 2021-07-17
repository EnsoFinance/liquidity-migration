//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import "../helpers/Whitelistable.sol";

abstract contract IAdapter is Whitelistable {
    struct Call {
        address payable target;
        bytes callData;
        uint256 value;
    }

    function outputTokens(address inputToken) external virtual view returns (address[] memory outputs);
    function isWhitelisted(address _token) external virtual view returns (bool);
    function encodeExecute(address _lp, address _amount) external virtual view returns (Call memory call);
}
