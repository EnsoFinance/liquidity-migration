//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import { SafeERC20, IERC20 } from "../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "./AbstractAdapter.sol";
// import "../helpers/Whitelistable.sol";

interface ISetToken {
    function getComponents() external view returns (address[] memory);
}

interface ISetModule {
    function redeem(address _setToken, uint256 _quantity, address _to) external;
}

/// @title Token Sets Vampire Attack Contract
/// @author Enso.finance (github.com/EnsoFinance)
/// @notice Adapter for redeeming the underlying assets from Token Sets

contract TokenSetAdapter is AbstractAdapter {
    using SafeERC20 for IERC20;

    address public generic;
    ISetModule public setModule;

    constructor(
        ISetModule setModule_,
        address generic_,
        address owner_
    ) AbstractAdapter(owner_)
    {
        setModule = setModule_;
        generic = generic_;
    }

    function outputTokens(address _lp)
        public
        view
        override
        returns (address[] memory outputs)
    {
        outputs = ISetToken(_lp).getComponents();
    }

    function encodeWithdraw(address _lp, uint256 _amount)
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

    // function encodeBuy(address _lp, uint256 _amount) 
    //     public
    //     override
    //     view
    //     onlyWhitelisted(_lp)
    //     returns(Call memory call)
    // {
        
    // }
}
