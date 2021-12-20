// SPDX-License-Identifier: WTFPL
import "../helpers/Timelocked.sol";
pragma solidity >=0.8.0;




contract mockFundHolder is Timelocked {

    uint256 public totalBalance;
    mapping (address => uint256) public addressBalance;

    constructor() 
    Timelocked(block.timestamp+3000, block.timestamp+1500, msg.sender) {}

    function depositETH() payable public {
        addressBalance[msg.sender] += msg.value;
        totalBalance += msg.value;
    }

    function withdraw(uint amount) public onlyUnlocked {
        require(addressBalance[msg.sender] >= amount, "ReqAmount greater than deposited");
        addressBalance[msg.sender] -= amount;
        totalBalance -= amount;
        payable(msg.sender).transfer(amount);
    }
}