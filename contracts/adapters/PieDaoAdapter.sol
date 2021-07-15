//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import { IAdapter } from "../interfaces/IAdapter.sol";
import "../helpers/Whitelistable.sol";


interface IPieDaoPool {
    function getTokens() external view returns (address[] memory);
    function exitPool(uint256 _amount) external;
}
contract PieDaoAdapter is IAdapter, Whitelistable {

    constructor(address owner_) {
        _setOwner(owner_);
    }

    function outputTokens(address _lp) 
        external 
        view 
        override 
        returns (address[] memory outputs) 
    {
        outputs = IPieDaoPool(_lp).getTokens();
    }
    
    function encodeExecute(address _lp, address _amount) 
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
                _lp,
                _amount
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
