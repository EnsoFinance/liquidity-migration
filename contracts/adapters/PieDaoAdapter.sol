//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import { IAdapter } from "../interfaces/IAdapter.sol";
import "../helpers/Whitelistable.sol";


// PieDao::PV2SmartPool
// PieDao::PCappedSmartPool
interface PieDaoPool {
    function joinPool(uint256 _amount) external;

    function exitPool(uint256 _amount) external;

    function getController() external view returns (address);

    function getTokens() external view returns (address[] memory);

    function calcTokensForAmount(uint256 _amount)
        external
        view
        returns (address[] memory tokens, uint256[] memory amounts);
}

contract PieDaoAdapter is IAdapter, Whitelistable {

    constructor(address _registry, address owner_) {
        _setOwner(owner_);
    }

    /// @notice to retrieve the underlying tokens in the pool
    /// @param inputToken is the PieDao Pool Address
    /// @return outputs is an array of the underlying tokens in the pool
    function outputTokens(address inputToken) external view override returns (address[] memory outputs) {
        // TODO: check experipie implementation
        return PieDaoPool(inputToken).getTokens();
    }

    // function execute(bytes calldata inputData) external override {
    //     (address inputToken, uint256 amount) = abi.decode(inputData, (address, uint256));
    //     PieDaoPool(inputToken).exitPool(amount);
    // }

    function encodeExecute(bytes calldata inputData) public view override returns (Call[] memory calls) {
        (address inputToken, uint256 amount) = abi.decode(inputData, (address, uint256));
        require(isWhitelisted(inputToken), "Not PieDao pool");
        bytes memory data = abi.encodeWithSelector(PieDaoPool(inputToken).exitPool.selector, amount);
        calls = new Call[](1);
        calls[0] = Call(payable(inputToken), data, 0);
        return calls;
    }
     
    /**
    * @param _token to view pool token
    * @return if token in whiteliste
    */
    function isWhitelisted(address _token) 
        public
        view
        override
        returns(bool)
    {
        return whitelisted[_token];
    }
}
