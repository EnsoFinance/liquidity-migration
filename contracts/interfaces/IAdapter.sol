//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

interface IAdapter {
    struct Call {
        address payable target;
        bytes callData;
        uint256 value;
    }

    function outputTokens(address inputToken) external view returns (address[] memory outputs);
    function isWhitelisted(address _token) external view returns (bool);
    function encodeExecute(address _lp, address _amount) external view returns (Call memory call);
}
