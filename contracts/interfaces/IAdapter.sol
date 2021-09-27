//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

interface IAdapter {
    struct Call {
        address payable target;
        bytes callData;
        uint256 value;
    }

    function outputTokens(address inputToken) external view returns (address[] memory outputs);

    function encodeWithdraw(address _lp, uint256 _amount) external view returns (Call memory call);

    function buy(address _lp, address _exchange, uint256 _minAmountOut, uint256 _deadline) external payable;

    function getAmountOut(address _lp, address _exchange, uint256 _amountIn) external view returns (uint256);

    function isWhitelisted(address _token) external view returns (bool);

    function isUnderlying(address _lp, address _token) external view returns (bool);

    function numberOfUnderlying(address _lp) external view returns (uint256);
}
