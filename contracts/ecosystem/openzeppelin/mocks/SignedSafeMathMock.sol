// SPDX-License-Identifier: WTFPL

pragma solidity ^0.8.0;

import "../utils/math/SignedSafeMath.sol";

contract SignedSafeMathMock {
    function mul(int256 a, int256 b) public pure returns (int256) {
        return SignedSafeMath.mul(a, b);
    }

    function div(int256 a, int256 b) public pure returns (int256) {
        return SignedSafeMath.div(a, b);
    }

    function sub(int256 a, int256 b) public pure returns (int256) {
        return SignedSafeMath.sub(a, b);
    }

    function add(int256 a, int256 b) public pure returns (int256) {
        return SignedSafeMath.add(a, b);
    }
}
