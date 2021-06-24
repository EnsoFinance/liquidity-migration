//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import {IAdapter} from "../interfaces/IAdapter.sol";

// PieDao::SmartPoolRegistry
interface PieDaoRegistry {
    function inRegistry(address _pool) external view returns (bool);

    function entries(uint256 _index) external view returns (address);

    function addSmartPool(address _smartPool) external;

    function removeSmartPool(uint256 _index) external;

    function removeSmartPoolByAddress(address _address) external;
}

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


contract PieDaoAdapter is IAdapter{

    address immutable public registry;

    constructor(address _registry) {
        registry = _registry;
    }

    function isInputToken(address token) public override view returns (bool) {
        return PieDaoRegistry(registry).inRegistry(token);
    }

    function inputTokens() public override view returns (address[] memory inputs) {
        PieDaoRegistry pieDaoRegistry = PieDaoRegistry(registry);
        for (uint i = 0; i < inputs.length; i++) {
            address pool = pieDaoRegistry.entries(i);
            if (pool == address(0)) {
                break;
            }
            inputs[i] = pool;
        }
    }

    function outputTokens(address inputToken) external view override returns (address[] memory outputs) {
        // TODO: check experipie implementation
        return PieDaoPool(inputToken).getTokens();
    }

    function execute(bytes calldata inputData) external override {
        (address inputToken, uint256 amount) = abi.decode(inputData, (address, uint256));
        PieDaoPool(inputToken).exitPool(amount);
    }

    function encodeExecute(bytes calldata inputData) public view override returns (Call[] memory calls) {
        (address inputToken, uint256 amount) = abi.decode(inputData, (address, uint256));
        require(isInputToken(inputToken), "Not PieDao pool");
        bytes memory data = abi.encodeWithSelector(PieDaoPool(inputToken).exitPool.selector, amount);
        calls = new Call[](1);
        calls[0] = Call(payable(inputToken), data, 0);
        return calls;
    }

}
