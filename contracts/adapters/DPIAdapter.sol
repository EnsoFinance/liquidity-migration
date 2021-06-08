//SPDX-License-Identifier: GPL-3.0-or-later

// liquidityMigration contract => gets the LP Tokens => sends these to the genericRouter
// genericRouter ==> multiCalls, transfer the underlying token to the strategy
// DPIAdapter


import { SafeERC20, IERC20 } from "../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import {IAdapter} from "../interfaces/IAdapter.sol";


/**
 * @title ISetToken
 * @author Set Protocol
 *
 * Interface for operating with SetTokens.
 */
interface ISetToken {
    function getComponents() external view returns(address[] memory);
}

interface ISetBasicIsstanceModuleAddress {
    function redeem(address _setToken, uint256 _quantity,address _to) external;
}


pragma solidity 0.8.2;

/// @title DPI Vampire Attack Contract for DPI Token
/// @author Enso.finance (github.com/amateur-dev)
/// @notice Adapter for redeeming the underlying assets from DPI 

contract DPIAdapter {
    using SafeERC20 for IERC20;

    // state variables
    ISetBasicIsstanceModuleAddress public setBasicIssuanceModule;
    mapping(address => uint) public whitelistedTokens;
    address private manager;
    
    // events
    event RedemptionSuccessful();

    // modifers
    modifier onlyManager {
        require (msg.sender == manager, "DPIA: not authorised");
        _;
    }

    // constructor
    constructor(ISetBasicIsstanceModuleAddress setBasicIssuanceModuleAddress, addresss managerAddress) {
        setBasicIssuanceModule = setBasicIssuanceModuleAddress;
        manager = managerAddress;
    } 

    

    
    // readerFunctions
    function isInputToken(address token) public override view returns (bool) {
            if (whitelistedTokens[token]==1) {
                return true;
            }
            return false;
        }    
    // executeableFunctions

    /// @notice Migrates the Token Set Contract's underlying assets under management
    /// @param tokenSetAddress is the address of the Token Set (eg DPI) which needs to be redeemed
    /// @param quantity of the coins that needs to be redeemed
    /// @param toWhom is the address to which all the underlying assets need to be sent at the time redemption

    // TODO: working on this function call
    function execute(bytes calldata inputData) external override {
        (address tokenSetAddress, uint256 quantity, address toWhom) = abi.decode(inputData, (address, uint256, address));
        require (isInputToken(tokenSetAddress), "DPIA: invalid tokenSetAddress");
        IERC20(tokenSetAddress).transferFrom(msg.sender, address(this), quantity);
        address[] memory components = ISetToken(tokenSetAddress).getComponents();
        uint[] memory pre = new uint[](components.length);
        for (uint256 i = 0; i < components.length; i++) {
                pre[i]=IERC20(components[i]).balanceOf(address(this));
        }
        setBasicIssuanceModule.redeem(
            tokenSetAddress,
            quantity,
            toWhom
        );
        uint[] memory post = new uint[](components.length);
        for (uint256 i = 0; i < components.length; i++) {
                post[i]=IERC20(components[i]).balanceOf(address(this));
        }
        for (uint256 i = 0; i < components.length; i++) {
            require((post[i]>=pre[i]), "DPIA: Redemption issue");
        }
        emit RedemptionSuccessful();
    }
    function encodeExecute(bytes calldata inputData) public view override returns (Call[] memory calls) {
        (address tokenSetAddress, uint256 quantity, address toWhom) = abi.decode(inputData, (address, uint256, address));
        require (isInputToken(tokenSetAddress), "DPIA: invalid tokenSetAddress");
        bytes memory data = abi.encodeWithSelector(PieDaoPool(inputToken).exitPool.selector, amount);
        bytes memory data = abi.encodeWithSelector(setBasicIssuanceModule.redeem.selector, tokenSetAddress, quantity, toWhom);
        calls[0] = Call(payable(setBasicIssuanceModule), data, 0);
    }

    // controllingFunctions
    function addAcceptedTokensToWhitelist(address tokenAddress) public onlyManager returns (bool) {
        whitelistedTokens(tokenAddress) = 1;
    }
}



