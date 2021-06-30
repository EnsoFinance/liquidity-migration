//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

interface IAdapter {
    struct Call {
        address payable target;
        bytes callData;
        uint256 value;
    }

    function isInputToken(address token) external view returns (bool);

    function inputTokens() external view returns (address[] memory input);

    function outputTokens(address inputToken) external view returns (address[] memory outputs);

    // function execute(bytes calldata data) external;

    function encodeExecute(bytes calldata data) external view returns (Call[] memory call);
}
