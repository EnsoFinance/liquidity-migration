//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface IProxy {
    function getImplementation() external view returns (address);
}
