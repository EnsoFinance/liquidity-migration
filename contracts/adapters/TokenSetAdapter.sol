//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import { SafeERC20, IERC20 } from "../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "./AbstractAdapter.sol";
import "hardhat/console.sol";

interface ISetToken {
    function getComponents() external view returns (address[] memory);
    function isInitializedModule(address _module) external view returns (bool);
}

interface IBasicIssuanceModule {
    function redeem(address _setToken, uint256 _quantity, address _to) external;
}

/// @title Token Sets Vampire Attack Contract
/// @author Enso.finance (github.com/EnsoFinance)
/// @notice Adapter for redeeming the underlying assets from Token Sets

contract TokenSetAdapter is AbstractAdapter {
    using SafeERC20 for IERC20;

    address public generic;
    IBasicIssuanceModule public basicModule;
    IBasicIssuanceModule public debtModule;
    mapping (address => bool) private _leveraged;

    constructor(
        IBasicIssuanceModule basicModule_,
        IBasicIssuanceModule debtModule_,
        address generic_,
        address owner_
    ) AbstractAdapter(owner_)
    {
        basicModule = basicModule_;
        debtModule = debtModule_;
        generic = generic_;
        _leveraged[0xAa6E8127831c9DE45ae56bB1b0d4D4Da6e5665BD] = true; // ETH2X
        _leveraged[0x0B498ff89709d3838a063f1dFA463091F9801c2b] = true; // BTC2X
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
        if (_leveraged[_lp]) {
            call = Call(
                payable(address(debtModule)),
                abi.encodeWithSelector(
                    debtModule.redeem.selector,
                    _lp,
                    _amount,
                    generic
                ),
                0
            );
        } else {
            call = Call(
                payable(address(basicModule)),
                abi.encodeWithSelector(
                    basicModule.redeem.selector,
                    _lp,
                    _amount,
                    generic
                ),
                0
            );
        }
    }
}
