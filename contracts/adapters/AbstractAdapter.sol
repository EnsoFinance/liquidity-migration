//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.2;

import "../interfaces/IAdapter.sol";
import "../helpers/Whitelistable.sol";

import "../interfaces/IUniswapV2Router.sol";

/// @title Token Sets Vampire Attack Contract
/// @author Enso.finance (github.com/EnsoFinance)
/// @notice Adapter for redeeming the underlying assets from Token Sets

abstract contract AbstractAdapter is IAdapter, Whitelistable {
    address public constant OWNER = 0xca702d224D61ae6980c8c7d4D98042E22b40FFdB;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant SUSHI = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
    address public constant UNI_V2 = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address public constant UNI_V3 = 0xE592427A0AEce92De3Edee1F18E0157C05861564;

    /**
    * @dev Require exchange registered
    */
    modifier onlyExchange(address _exchange) {
        require(isExchange(_exchange), "AbstractAdapter#buy: should be exchanges");
        _;
    }

    constructor() {
        _setOwner(OWNER);
    }

    function outputTokens(address _lp)
        public
        view
        override
        virtual
        returns (address[] memory outputs);

    function encodeWithdraw(address _lp, uint256 _amount)
        public
        override
        virtual
        view
        returns(Call memory call);

    function buy(address _lp, address _exchange, uint256 _minAmountOut, uint256 _deadline)
        public
        override
        virtual
        payable
        onlyExchange(_exchange)
        onlyWhitelisted(_lp)
    {
        if (_exchange == UNI_V3) {
            _buyV3(_lp, _minAmountOut, _deadline);
        } else {
            _buyV2(_lp, _exchange, _minAmountOut, _deadline);
        }
    }

    function getAmountOut(
        address _lp,
        address _exchange,
        uint256 _amountIn
    ) 
        external
        override
        virtual
        view
        onlyExchange(_exchange)
        onlyWhitelisted(_lp)
        returns (uint256)
    {
        if (_exchange == UNI_V3) {
            _getV3(_lp, _amountIn);
        } else {
            _getV2(_lp, _exchange, _amountIn);
        }
    }

    function _buyV2(
        address _lp, 
        address _exchange, 
        uint256 _minAmountOut, 
        uint256 _deadline
    )
        internal
    {
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = _lp;
        IUniswapV2Router(_exchange).swapExactETHForTokens{value: msg.value}(
            _minAmountOut,
            path,
            msg.sender,
            _deadline
        );
    }

    function _buyV3(
        address _lp,
        uint256 _minAmountOut, 
        uint256 _deadline
    )
        internal
    {
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = _lp;
        IUniswapV2Router(UNI_V3).swapExactETHForTokens{value: msg.value}(
            _minAmountOut,
            path,
            msg.sender,
            _deadline
        );
    }

    function _getV2(address _lp, address _exchange, uint256 _amountIn)
        internal
        view
        returns (uint256)
    {
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = _lp;
        return IUniswapV2Router(_exchange).getAmountsOut(_amountIn, path)[1];
    }

    function _getV3(address _lp, uint256 _amountIn)
        internal
        view
        returns (uint256)
    {
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = _lp;
        return IUniswapV2Router(UNI_V3).getAmountsOut(_amountIn, path)[1];
    }

    /**
    * @param _lp to view pool token
    * @return if token in whitelist
    */
    function isWhitelisted(address _lp)
        public
        view
        override
        returns(bool)
    {
        return whitelisted[_lp];
    }

    function isUnderlying(address _lp, address _token) external view override returns (bool) {
        return _underlying[_lp][_token];
    }

    function numberOfUnderlying(address _lp) external view override returns (uint256) {
        return _count[_lp];
    }
    
    function isExchange(address _exchange)
        public
        view
        returns (bool)
    {
        return(_exchange == SUSHI || _exchange == UNI_V2 || _exchange == UNI_V3);
    }

    function _addUnderlying(address _lp) internal override {
        address[] memory underlyingTokens = outputTokens(_lp);
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            address utAddress = underlyingTokens[i];
            _underlying[_lp][utAddress] = true;
        }
        _count[_lp] = underlyingTokens.length;
    }

    function _removeUnderlying(address _lp) internal override {
        address[] memory underlyingTokens = outputTokens(_lp);
        for (uint256 i = 0; i < underlyingTokens.length; i++) {
            address utAddress = underlyingTokens[i];
            _underlying[_lp][utAddress] = false;
        }
        _count[_lp] = 0;
    }
}
