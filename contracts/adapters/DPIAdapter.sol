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

// Logic of this Adapter Contract
// MustHaves
// 1. User will first have to approve this contract to use the client's DPI Tokens || Front-end task || out of purview of this contract {generic liquidity migration DIPESH TODO}
// 2. User will then call a function that will transfer the DPI coins to this contract
// 3. The contract will 'redeem' the DPI toknens
// GoodToHaves
// 4. First find out the components that will be released by the DPI Contract
// 5. Check the balances already held for each of the components before calling the redeem function
// 6. Check the balances held for each of the components after calling the redeem function
// 7. Compute the difference between step 5 and step 6
// Extended (to be discussed and to be completed)
// 8. What to do with the underlying Tokens
// 9. ERC20 Token issuance strategy against the DPI tokens



/// @title DPI Vampire Attack Contract
/// @author Enso.finance (github.com/amateur-dev)
/// @notice Adapter for redeeming the underlying assets from DPI 

contract DPIAdapter {
    using SafeERC20 for IERC20;

    // state variables
    ISetBasicIsstanceModuleAddress public setBasicIssuanceModule;
    address[] public components;
    
    // events
    event RedemptionSuccessful();


    // constructor
    constructor(ISetBasicIsstanceModuleAddress setBasicIssuanceModuleAddress) {
        setBasicIssuanceModule = setBasicIssuanceModuleAddress;
    } 
    
    // readerFunctions
    
    // executeableFunctions

    /// @notice Migrates the Token Set Contract's underlying assets under management
    /// @param tokenSetAddress is the address of the Token Set (eg DPI) which needs to be redeemed
    /// @param quantity of the coins that needs to be redeemed
    /// @param toWhom is the address to which all the underlying assets need to be sent at the time redemption
    function migrateLiquidity(address tokenSetAddress, uint256 quantity, address toWhom) external returns (address[] memory){
        // IERC20(tokenSetAddress).transferFrom(msg.sender, address(this), quantity);
        components = ISetToken(tokenSetAddress).getComponents();
        return components;
        // uint256[] memory preRedeemComponentBalances;
        // for (uint256 i = 0; i < components.length; i++) {
        //         preRedeemComponentBalances[i]=IERC20(components[i]).balanceOf(address(this));
        // }
        // return preRedeemComponentBalances;
        
        // setBasicIssuanceModule.redeem(
        //     tokenSetAddress,
        //     quantity,
        //     toWhom
        // );
        // uint256[] memory postRedeemComponentBalances;
        // for (uint256 i = 0; i < components.length; i++) {
        //         postRedeemComponentBalances[i]=IERC20(components[i]).balanceOf(address(this));
        // }
        // for (uint256 i = 0; i < components.length; i++) {
        //     require((postRedeemComponentBalances[i]>preRedeemComponentBalances[i]), "DPIA: Redemption issue");
        // }
        // emit RedemptionSuccessful();
        //TODO: What to do after the tokens are transferred over

    // controllingFunctions
    }
}



