//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

Logic of this Adapter Contract
MustHaves
1. User will first have to approve this contract to use the client's DPI Tokens || Front-end task || out of purview of this contract
2. User will then call a function that will transfer the DPI coins to this contract
3. The contract will 'redeem' the DPI toknens
GoodToHaves
4. First find out the components that will be released by the DPI Contract
5. Check the balances already held for each of the components before calling the redeem function
6. Check the balances held for each of the components after calling the redeem function
7. Compute the difference between step 5 and step 6
Extended (to be discussed and to be completed)
8. What to do with the underlying Tokens
9. ERC20 Token issuance strategy against the DPI tokens


/// @title DPI Vampire Attack Contract
/// @author Enso.finance (github.com/amateur-dev)
/// @notice Adapter for redeeming the underlying assets from DPI 

contract DPIAdapter {
    

}



