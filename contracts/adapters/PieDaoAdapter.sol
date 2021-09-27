//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import "./AbstractAdapter.sol";
import "../interfaces/IUniswapV2Router.sol";

interface IPieDaoPool {
    function getTokens() external view returns (address[] memory);
    function exitPool(uint256 _amount) external;
}

contract PieDaoAdapter is AbstractAdapter {
    constructor(address owner_, address weth_) AbstractAdapter(owner_, weth_) {}

    function outputTokens(address _lp)
        public
        view
        override
        returns (address[] memory outputs)
    {
        outputs = IPieDaoPool(_lp).getTokens();
    }

    function encodeWithdraw(address _lp, uint256 _amount)
        public
        override
        view
        onlyWhitelisted(_lp)
        returns(Call memory call)
    {
        call = Call(
            payable(_lp),
            abi.encodeWithSelector(
                IPieDaoPool(_lp).exitPool.selector,
                _amount
            ),
            0
        );
    }

    function buy(address _lp, address _exchange, uint256 _minAmountOut, uint256 _deadline)
        public
        override
        payable
        onlyWhitelisted(_lp)
    {
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = _lp;
        IUniswapV2Router(_exchange).swapExactETHForTokens{value: msg.value}(
            _minAmountOut,
            path,
            msg.sender,
            _deadline
        );
    }

    function getAmountOut(
        address _lp,
        address _exchange,
        uint256 _amountIn
    ) external override view onlyWhitelisted(_lp) returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = _lp;
        return IUniswapV2Router(_exchange).getAmountsOut(_amountIn, path)[1];
    }
}
