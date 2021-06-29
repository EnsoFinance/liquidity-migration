//SPDX-License-Identifier: GPL-3.0-or-later

// liquidityMigration contract => gets the LP Tokens => sends these to the genericRouter
// genericRouter ==> multiCalls, transfer the underlying token to the strategy
// DPIAdapter

import { SafeERC20, IERC20 } from "../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import { IAdapter } from "../interfaces/IAdapter.sol";

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

/// @title DPI Vampire Attack Contract for DPI Token
/// @author Enso.finance (github.com/amateur-dev)
/// @notice Adapter for redeeming the underlying assets from DPI

contract DPIAdapter is IAdapter {
    using SafeERC20 for IERC20;

    // state variables
    ISetBasicIsstanceModuleAddress public setBasicIssuanceModule;
    mapping(address => uint256) public whitelistedTokens;
    address private manager;

    // events
    event RedemptionSuccessful();

    // modifers
    modifier onlyManager {
        require(msg.sender == manager, "DPIA: not authorised");
        _;
    }

    // constructor
    constructor(ISetBasicIsstanceModuleAddress setBasicIssuanceModuleAddress, address managerAddress) {
        setBasicIssuanceModule = setBasicIssuanceModuleAddress;
        manager = managerAddress;
    }

    // readerFunctions
    function isInputToken(address token) public view override returns (bool) {
        if (whitelistedTokens[token] == 1) {
            return true;
        }
        return false;
    }

    //TODO: To discuss with Kyle the idea of the inputTokens function
    function inputTokens() public view override returns (address[] memory inputs) {}

    /// @notice to retrieve the underlying tokens in the pool
    /// @param tokenSetAddress is the tokenSet Address
    /// @return outputs is an array of the underlying tokens in the pool
    function outputTokens(address tokenSetAddress) external view override returns (address[] memory outputs) {
        return outputs = ISetToken(tokenSetAddress).getComponents();
    }

    // executeableFunctions

    /// @notice Migrates the Token Set Contract's underlying assets under management

    function execute(bytes calldata inputData) external override {
        (address tokenSetAddress, uint256 quantity, address genericRouter) = abi.decode(
            inputData,
            (address, uint256, address)
        );
        require(isInputToken(tokenSetAddress), "DPIA: invalid tokenSetAddress");
        IERC20(tokenSetAddress).transferFrom(msg.sender, address(this), quantity);
        address[] memory components = ISetToken(tokenSetAddress).getComponents();
        uint256[] memory pre = new uint256[](components.length);
        for (uint256 i = 0; i < components.length; i++) {
            pre[i] = IERC20(components[i]).balanceOf(address(this));
        }
        setBasicIssuanceModule.redeem(tokenSetAddress, quantity, genericRouter);
        uint256[] memory post = new uint256[](components.length);
        for (uint256 i = 0; i < components.length; i++) {
            post[i] = IERC20(components[i]).balanceOf(address(this));
        }
        for (uint256 i = 0; i < components.length; i++) {
            require((post[i] >= pre[i]), "DPIA: Redemption issue");
        }
        emit RedemptionSuccessful();
    }

    function encodeExecute(bytes calldata inputData) public view override returns (Call[] memory calls) {
        (address tokenSetAddress, uint256 quantity, address genericRouterAddress) = abi.decode(
            inputData,
            (address, uint256, address)
        );
        require(isInputToken(tokenSetAddress), "DPIA: invalid tokenSetAddress");
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

    // controllingFunctions

    function addAcceptedTokensToWhitelist(address tokenAddress) public onlyManager returns (bool) {
        whitelistedTokens[tokenAddress] = 1;
        return true;
    }
}
