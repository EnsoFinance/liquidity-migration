//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import "./AbstractAdapter.sol";

interface IPieDaoPool {
    function getTokens() external view returns (address[] memory);
    function exitPool(uint256 _amount) external;
}

contract PieDaoAdapter is AbstractAdapter {
    constructor(address owner_) AbstractAdapter(owner_) {}

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

    // function encodeBuy(address _lp, uint256 _amountOut) 
    //     public
    //     override
    //     view
    //     onlyWhitelisted(_lp)
    //     returns(Call memory call)
    // {
    //     // uint256 _min = joinswapExternAmountIn;
    //     call = Call(
    //         payable(_lp),
    //         abi.encodeWithSelector(
    //             IPieDaoPool(_lp).joinswapPoolAmountOut.selector,
    //             WETH,
    //             _amount,
    //         ),
    //         0
    //     );

    //     //joinswapPoolAmountOut
    // }
}
