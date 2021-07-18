//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import "../interfaces/IAdapter.sol";
import "../helpers/Whitelistable.sol";

/// @title Token Sets Vampire Attack Contract
/// @author Enso.finance (github.com/amateur-dev)
/// @notice Adapter for redeeming the underlying assets from Token Sets

abstract contract AbstractAdapter is IAdapter, Whitelistable {

    constructor(address owner_  ) {
        _setOwner(owner_);
    }

    function outputTokens(address _lp)
        public
        view
        override
        virtual
        returns (address[] memory outputs);

    function encodeExecute(address _lp, uint256 _amount)
        public
        override
        virtual
        view
        returns(Call memory call);

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

    function isUnderlying(address _lp, address _token) external view override returns (bool) {
        return _underlying[_lp][_token];
    }

    function numberOfUnderlying(address _lp) external view override returns (uint256) {
        return _count[_lp];
    }

    function _addUnderlying(address _lp) internal override {
        address[] memory underlyingTokens = outputTokens(_lp);
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            address utAddress = underlyingTokens[i];
            _underlying[_lp][utAddress] = true;
        }
        _count[_lp] = underlyingTokens.length;
    }

    function _removeUnderlying(address _lp) internal override {
        address[] memory underlyingTokens = outputTokens(_lp);
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            address utAddress = underlyingTokens[i];
            _underlying[_lp][utAddress] = false;
        }
        _count[_lp] = 0;
    }
}
