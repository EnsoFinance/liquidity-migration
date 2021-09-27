//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import { SafeERC20, IERC20 } from "../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "./AbstractAdapter.sol";

interface ISigmaIndexPoolV1 {
    function getCurrentTokens() external view returns (address[] memory tokens);
    function exitPool(uint256 poolAmountIn, uint256[] calldata minAmountsOut) external;
}


/// @title Indexed Vampire Attack Contract
/// @author Enso.finance (github.com/EnsoFinance)
/// @notice Adapter for redeeming the underlying assets from Indexed Protocol

contract IndexedAdapter is AbstractAdapter {
    using SafeERC20 for IERC20;

    constructor(address owner_) AbstractAdapter(owner_) {}

    function outputTokens(address _lp)
        public
        view
        override
        returns (address[] memory outputs)
    {
        outputs = ISigmaIndexPoolV1(_lp).getCurrentTokens();
    }

    function encodeWithdraw(address _lp, uint256 _amount)
        public
        override
        view
        onlyWhitelisted(_lp)
        returns(Call memory call)
    {
        uint256[] memory _min = new uint256[](outputTokens(_lp).length);
        call = Call(
            payable(_lp),
            abi.encodeWithSelector(
                ISigmaIndexPoolV1(_lp).exitPool.selector,
                _amount,
                _min
            ),
            0
        );
    }
}
