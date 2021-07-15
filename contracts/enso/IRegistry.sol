//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import "../helpers/StrategyTypes.sol";

interface IRegistry is StrategyTypes {
    function register(address account) external;

    function registerAdapter(address adapter, ItemCategory category) external;

    function unregister(address account) external;

    function unregisterAdapter(address adapter) external;

    function approved(address account) external view returns (bool);

    function getAdapter(ItemCategory category) external view returns (address);
}
