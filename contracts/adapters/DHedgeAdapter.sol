//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import { SafeERC20, IERC20 } from "../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "./AbstractAdapter.sol";


interface IDHedge {
    function getFundComposition() external view returns(bytes32[] memory, uint256[] memory, uint256[] memory);
    function getAssetProxy(bytes32 key) external view returns(address);
    function withdraw(uint256 _fundTokenAmount) external;
}

/// @title DHedge Vampire Attack Contract
/// @author Enso.finance (github.com/EnsoFinance)
/// @notice Adapter for redeeming the underlying assets from Dhedge Protocol

contract DHedgeAdapter is AbstractAdapter {
    using SafeERC20 for IERC20;

    constructor(address owner_) AbstractAdapter(owner_) {}

    function outputTokens(address _lp)
        public
        view
        override
        returns (address[] memory outputs)
    {
        (bytes32[] memory assets, , ) = IDHedge(_lp).getFundComposition();
        for (uint256 i = 0; i < assets.length; i++) {
            outputs[i] = IDHedge(_lp).getAssetProxy(assets[i]);
        }
    }

    function encodeExecute(address _lp, uint256 _amount)
        public
        override
        view
        onlyWhitelisted(_lp)
        returns(Call memory call)
    {
        call = Call(
            payable(_lp),
            abi.encodeWithSelector(
                IDHedge(_lp).withdraw.selector,
                _amount
            ),
            0
        );
    }
}