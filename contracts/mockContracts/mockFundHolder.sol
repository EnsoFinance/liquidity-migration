// SPDX-License-Identifier: WTFPL

import "../helpers/Timelocked.sol";

pragma solidity 0.8.2;


contract mockFundHolder is Timelocked {

    uint256 public totalBalance;
    mapping (address => uint256) addressBalance;

    constructor() 
    Timelocked(block.timestamp+300, block.timestamp+150, msg.sender) {}

    function depositETH() payable public {
        addressBalance[msg.sender] += msg.value;
        totalBalance += msg.value;
    }

    function withdraw(uint amount) public onlyUnlocked {
        require(addressBalance[msg.sender] >= amount, "ReqAmount greater than deposited");
        payable(msg.sender).transfer(amount);
    }
    

    
    
}