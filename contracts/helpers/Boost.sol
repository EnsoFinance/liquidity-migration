// SPDX-License-Identifier: WTFPL

pragma solidity ^0.8.0;

library Boost {
    // Calculates additional tokens to give for length of stake
    function boostModifier(
        uint256 amount,
        uint16 daysToStake,
        uint16 maxDays
    ) public pure returns (uint256 boost) {
        // TODO: extra check?
        // require(daysToStake <= state.maxDays, "Staking too long");
        boost = (uint256(daysToStake) * amount * 3) / uint256(maxDays);
    }
}
