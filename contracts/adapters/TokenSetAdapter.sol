//SPDX-License-Identifier: GPL-3.0-or-later

import { SafeERC20, IERC20 } from "../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import { IAdapter } from "../interfaces/IAdapter.sol";
// import "../helpers/Whitelistable.sol";

interface ISetToken {
    function getComponents() external view returns (address[] memory);
}

interface ISetModule {
    function redeem(address _setToken, uint256 _quantity, address _to) external;
}


pragma solidity 0.8.2;

/// @title Token Sets Vampire Attack Contract
/// @author Enso.finance (github.com/amateur-dev)
/// @notice Adapter for redeeming the underlying assets from Token Sets

contract TokenSetAdapter is IAdapter {
    using SafeERC20 for IERC20;

    address public generic;
    ISetModule public setModule;

    constructor(
        ISetModule setModule_, 
        address generic_,
        address owner_
    ) 
    {
        setModule = setModule_;
        generic = generic_;
        _setOwner(owner_);
    }

    function outputTokens(address _lp) 
        public 
        view 
        override 
        returns (address[] memory outputs) 
    {
        outputs = ISetToken(_lp).getComponents();
    }

    function encodeExecute(address _lp, address _amount) 
        public
        override
        view
        onlyWhitelisted(_lp)
        returns(Call memory call)
    {
        call = Call(
            payable(address(setModule)),
            abi.encodeWithSelector(
                setModule.redeem.selector, 
                _lp,
                _amount,
                generic
            ),
            0
        );
    }

    /**
    * @param _lp to view pool token
    * @return if token in whitelist
    */
    function isWhitelisted(address _lp) 
        public
        view
        override
        returns(bool)
    {
        return whitelisted[_lp];
    }

    function addToUnderlyingTokenMapping(address _lp) internal override {
        address[] memory underlyingTokens = outputTokens(_lp);
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            address utAddress = underlyingTokens[i];
            underlyingTokenInTheLp[_lp][utAddress] = true;
        }
        numberOfUnderlyingTokens[_lp] = underlyingTokens.length;
    }

    function removeFromUnderlyingTokenMapping(address _lp) internal override {
        address[] memory underlyingTokens = outputTokens(_lp);
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            address utAddress = underlyingTokens[i];
            underlyingTokenInTheLp[_lp][utAddress] = false;
        }
        numberOfUnderlyingTokens[_lp] = 0;
    }
}
