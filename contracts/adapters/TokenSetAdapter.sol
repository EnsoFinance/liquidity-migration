//SPDX-License-Identifier: GPL-3.0-or-later

import { SafeERC20, IERC20 } from "../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import { IAdapter } from "../interfaces/IAdapter.sol";
import "../helpers/Whitelistable.sol";


interface ISetToken {
    function getComponents() external view returns (address[] memory);
}

interface ISetBasicIsstanceModuleAddress {
    function redeem(
        address _setToken,
        uint256 _quantity,
        address _to
    ) external;
}


pragma solidity 0.8.2;

/// @title Token Sets Vampire Attack Contract
/// @author Enso.finance (github.com/amateur-dev)
/// @notice Adapter for redeeming the underlying assets from Token Sets

contract TokenSetAdapter is IAdapter, Whitelistable {
    using SafeERC20 for IERC20;

    // state variables
    ISetBasicIsstanceModuleAddress public setBasicIssuanceModule;

    // events
    event RedemptionSuccessful();

    // constructor
    constructor(ISetBasicIsstanceModuleAddress setBasicIssuanceModuleAddress, address owner_) {
        setBasicIssuanceModule = setBasicIssuanceModuleAddress;
        _setOwner(owner_);
    }

    /// @notice to retrieve the underlying tokens in the pool
    /// @param tokenSetAddress is the tokenSet Address
    /// @return outputs is an array of the underlying tokens in the pool
    function outputTokens(address tokenSetAddress) external view override returns (address[] memory outputs) {
        return outputs = ISetToken(tokenSetAddress).getComponents();
    }

    // executeableFunctions

    /// @notice Migrates the Token Set Contract's underlying assets under management

    // function execute(bytes calldata inputData) external override {
    //     (address tokenSetAddress, uint256 quantity, address genericRouter) = abi.decode(
    //         inputData,
    //         (address, uint256, address)
    //     );
    //     require(isInputToken(tokenSetAddress), "TSA: invalid tokenSetAddress");
    //     IERC20(tokenSetAddress).transferFrom(msg.sender, address(this), quantity);
    //     address[] memory components = ISetToken(tokenSetAddress).getComponents();
    //     uint256[] memory pre = new uint256[](components.length);
    //     for (uint256 i = 0; i < components.length; i++) {
    //         pre[i] = IERC20(components[i]).balanceOf(address(this));
    //     }
    //     setBasicIssuanceModule.redeem(tokenSetAddress, quantity, genericRouter);
    //     uint256[] memory post = new uint256[](components.length);
    //     for (uint256 i = 0; i < components.length; i++) {
    //         post[i] = IERC20(components[i]).balanceOf(address(this));
    //     }
    //     for (uint256 i = 0; i < components.length; i++) {
    //         require((post[i] >= pre[i]), "TSA: Redemption issue");
    //     }
    //     emit RedemptionSuccessful();
    // }

    function encodeExecute(bytes calldata inputData) public override view returns (Call[] memory calls) {
        (address tokenSetAddress, uint256 quantity, address genericRouterAddress) = abi.decode(
            inputData,
            (address, uint256, address)
        );
        require(isWhitelisted(tokenSetAddress), "TSA: invalid tokenSetAddress");
        bytes memory data = abi.encodeWithSelector(
            setBasicIssuanceModule.redeem.selector,
            tokenSetAddress,
            quantity,
            genericRouterAddress
        );
        calls = new Call[](1);
        calls[0] = Call(payable(address(setBasicIssuanceModule)), data, 0);
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
