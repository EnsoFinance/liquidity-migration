//SPDX-License-Identifier: GPL-3.0-or-later

import { SafeERC20, IERC20 } from "../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import { IAdapter } from "../interfaces/IAdapter.sol";
import "../helpers/Whitelistable.sol";

interface ISigmaIndexPoolV1 {
    function getCurrentTokens() external view returns (address[] memory tokens);
    function exitPool(uint256 poolAmountIn, uint256[] calldata minAmountsOut) external;
}

pragma solidity 0.8.2;

/// @title Indexed Vampire Attack Contract
/// @author Enso.finance (github.com/amateur-dev)
/// @notice Adapter for redeeming the underlying assets from Indexed Protocol

contract IndexedAdapter is IAdapter, Whitelistable {
    using SafeERC20 for IERC20;


    constructor(address owner_) {
        _setOwner(owner_);
    }

    function outputTokens(address _lp) 
        public
        view
        override
        returns (address[] memory outputs) 
    {
        outputs = ISigmaIndexPoolV1(_lp).getCurrentTokens();
    }

    function encodeExecute(address _lp, address _amount) 
        public
        override
        view
        onlyWhitelisted(_lp)
        returns(Call memory call)
    {
        
        uint256[] memory _min = new uint256[](outputTokens(_lp).length);
         // TODO: we should calculate min expected
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

    /**
    * @param _lp to view pool token
    * @return if token in whiteliste
    */
    function isWhitelisted(address _lp) 
        public
        view
        override
        returns(bool)
    {
        return whitelisted[_lp];
    }
}
