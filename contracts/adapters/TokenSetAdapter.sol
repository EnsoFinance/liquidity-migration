//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import { SafeERC20, IERC20 } from "../ecosystem/openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "./AbstractAdapter.sol";

interface ISetToken {
    function getComponents() external view returns (address[] memory);
    function isInitializedModule(address _module) external view returns (bool);
}

interface IBasicIssuanceModule {
    function redeem(address _setToken, uint256 _quantity, address _to) external;
}

interface INAVIssuanceModule {
    function issueWithEther(address _setToken, uint256 _minSetTokenReceiveQuantity, address _to) external payable;

    function getExpectedSetTokenIssueQuantity(address _setToken, address _reserveAsset, uint256 _reserveAssetQuantity)
        external
        view
        returns (uint256);
}

/// @title Token Sets Vampire Attack Contract
/// @author Enso.finance (github.com/EnsoFinance)
/// @notice Adapter for redeeming the underlying assets from Token Sets

contract TokenSetAdapter is AbstractAdapter {
    using SafeERC20 for IERC20;

    uint256 private constant SLIPPAGE = 999;
    uint256 private constant DIVISOR = 1000;

    address public generic;
    IBasicIssuanceModule public basicModule;
    INAVIssuanceModule public navModule;

    constructor(
        IBasicIssuanceModule basicModule_,
        INAVIssuanceModule navModule_,
        address generic_,
        address owner_
    ) AbstractAdapter(owner_)
    {
        basicModule = basicModule_;
        navModule = navModule_;
        generic = generic_;
    }

    function outputTokens(address _lp)
        public
        view
        override
        returns (address[] memory outputs)
    {
        outputs = ISetToken(_lp).getComponents();
    }

    function encodeWithdraw(address _lp, uint256 _amount)
        public
        override
        view
        onlyWhitelisted(_lp)
        returns(Call memory call)
    {
        call = Call(
            payable(address(basicModule)),
            abi.encodeWithSelector(
                basicModule.redeem.selector,
                _lp,
                _amount,
                generic
            ),
            0
        );
    }

    function buy(address _lp, address _exchange, uint256 _minAmountOut, uint256 _deadline)
        public
        override
        payable
        onlyWhitelisted(_lp)
    {
        if (_exchange != address(0)) {
          require(isExchange(_exchange), "TokenSetAdapter#buy: should be exchanges");
          _buyV2(_lp, _exchange, _minAmountOut, _deadline);
        } else {
          require(ISetToken(_lp).isInitializedModule(address(navModule)), "NAVModule not supported");
          require(_deadline > block.timestamp, "Past deadline");
          navModule.issueWithEther{value: msg.value}(_lp, _minAmountOut, msg.sender);
        }
    }

    function getAmountOut(address _lp, address _exchange, uint256 _amountIn)
        external
        override
        view
        onlyWhitelisted(_lp)
        returns (uint256)
    {
        if (_exchange != address(0)) {
            require(isExchange(_exchange), "TokenSetAdapter#buy: should be exchanges");
            return _getV2(_lp, _exchange, _amountIn);
        } else {
            return navModule.getExpectedSetTokenIssueQuantity(_lp, WETH, _amountIn);
        }
    }
}
