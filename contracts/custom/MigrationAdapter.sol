//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import "../adapters/AbstractAdapter.sol";

contract MigrationAdapter is AbstractAdapter {
    constructor(address owner_) AbstractAdapter(owner_) {}

    function outputTokens(address)
        public
        view
        override
        returns (address[] memory outputs)
    {
        return new address[](0);
    }

    function encodeMigration(address, address, address _lp, uint256)
        public
        override
        view
        onlyWhitelisted(_lp)
        returns (Call[] memory calls)
    {
        calls = new Call[](1);
        calls[0] = Call(_lp, new bytes(0));
        return calls;
    }

    function encodeWithdraw(address _lp, uint256)
        public
        override
        view
        onlyWhitelisted(_lp)
        returns (Call[] memory calls)
    {
        return new Call[](0);
    }
}
