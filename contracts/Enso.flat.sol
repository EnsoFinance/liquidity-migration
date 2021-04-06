
// File contracts/interfaces/IERC1271.sol

//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.5.0 <0.7.0;

interface IERC1271 {
 function isValidSignature(
   bytes calldata _messageHash,
   bytes calldata _signature)
   external
   view
   returns (bytes4 magicValue);
}


// File @openzeppelin/contracts/cryptography/ECDSA.sol@v3.3.0


pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev Elliptic Curve Digital Signature Algorithm (ECDSA) operations.
 *
 * These functions can be used to verify that a message was signed by the holder
 * of the private keys of a given address.
 */
library ECDSA {
    /**
     * @dev Returns the address that signed a hashed message (`hash`) with
     * `signature`. This address can then be used for verification purposes.
     *
     * The `ecrecover` EVM opcode allows for malleable (non-unique) signatures:
     * this function rejects them by requiring the `s` value to be in the lower
     * half order, and the `v` value to be either 27 or 28.
     *
     * IMPORTANT: `hash` _must_ be the result of a hash operation for the
     * verification to be secure: it is possible to craft signatures that
     * recover to arbitrary addresses for non-hashed data. A safe way to ensure
     * this is by receiving a hash of the original message (which may otherwise
     * be too long), and then calling {toEthSignedMessageHash} on it.
     */
    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        // Check the signature length
        if (signature.length != 65) {
            revert("ECDSA: invalid signature length");
        }

        // Divide the signature in r, s and v variables
        bytes32 r;
        bytes32 s;
        uint8 v;

        // ecrecover takes the signature parameters, and the only way to get them
        // currently is to use assembly.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (281): 0 < s < secp256k1n ÷ 2 + 1, and for v in (282): v ∈ {27, 28}. Most
        // signatures from current libraries generate a unique signature with an s-value in the lower half order.
        //
        // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
        // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
        // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
        // these malleable signatures as well.
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "ECDSA: invalid signature 's' value");
        require(v == 27 || v == 28, "ECDSA: invalid signature 'v' value");

        // If the signature is valid (and not malleable), return the signer address
        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "ECDSA: invalid signature");

        return signer;
    }

    /**
     * @dev Returns an Ethereum Signed Message, created from a `hash`. This
     * replicates the behavior of the
     * https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign[`eth_sign`]
     * JSON-RPC method.
     *
     * See {recover}.
     */
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        // 32 is the length in bytes of hash,
        // enforced by the type signature above
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}


// File contracts/ERC1271.sol

pragma solidity 0.6.12;


abstract contract ERC1271 is IERC1271 {
    using ECDSA for bytes32;

    bytes4 constant internal MAGICVALUE = 0x20c13b0b;
    bytes4 constant internal INVALID_SIGNATURE = 0xffffffff;

    function isValidSignature(
      bytes memory _message,
      bytes memory _signature
    )
      public
      override
      view
      returns (bytes4 magicValue)
    {
      address signer = _getEthSignedMessageHash(_message).recover(_signature);
      magicValue = _checkSigner(signer) ? MAGICVALUE : INVALID_SIGNATURE;
    }

    // @dev Adds ETH signed message prefix to bytes message and hashes it
    // @param _data Bytes data before adding the prefix
    // @return Prefixed and hashed message
    function _getEthSignedMessageHash(bytes memory _data) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n", _uint2str(_data.length), _data));
    }

    // @dev Convert uint to string
    // @param _num Uint to be converted
    // @return String equivalent of the uint
    function _uint2str(uint _num) private pure returns (string memory _uintAsString) {
        if (_num == 0) {
            return "0";
        }
        uint i = _num;
        uint j = _num;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (i != 0) {
            bstr[k--] = byte(uint8(48 + i % 10));
            i /= 10;
        }
        return string(bstr);
    }

    // @notice Confirm signer is permitted to sign on behalf of contract
    // @dev Abstract function to implemented by importing contract
    // @param signer The address of the message signer
    // @return Bool confirming whether signer is permitted
    function _checkSigner(address signer) internal view virtual returns (bool);
}


// File @openzeppelin/contracts/GSN/Context.sol@v3.3.0


pragma solidity >=0.6.0 <0.8.0;

/*
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with GSN meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address payable) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes memory) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        return msg.data;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v3.3.0


pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor () internal {
        address msgSender = _msgSender();
        _owner = msgSender;
        emit OwnershipTransferred(address(0), msgSender);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(_owner == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}


// File @openzeppelin/contracts/proxy/Proxy.sol@v3.3.0


pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev This abstract contract provides a fallback function that delegates all calls to another contract using the EVM
 * instruction `delegatecall`. We refer to the second contract as the _implementation_ behind the proxy, and it has to
 * be specified by overriding the virtual {_implementation} function.
 * 
 * Additionally, delegation to the implementation can be triggered manually through the {_fallback} function, or to a
 * different contract through the {_delegate} function.
 * 
 * The success and return data of the delegated call will be returned back to the caller of the proxy.
 */
abstract contract Proxy {
    /**
     * @dev Delegates the current call to `implementation`.
     * 
     * This function does not return to its internall call site, it will return directly to the external caller.
     */
    function _delegate(address implementation) internal {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    /**
     * @dev This is a virtual function that should be overriden so it returns the address to which the fallback function
     * and {_fallback} should delegate.
     */
    function _implementation() internal virtual view returns (address);

    /**
     * @dev Delegates the current call to the address returned by `_implementation()`.
     * 
     * This function does not return to its internall call site, it will return directly to the external caller.
     */
    function _fallback() internal {
        _beforeFallback();
        _delegate(_implementation());
    }

    /**
     * @dev Fallback function that delegates calls to the address returned by `_implementation()`. Will run if no other
     * function in the contract matches the call data.
     */
    fallback () external payable {
        _fallback();
    }

    /**
     * @dev Fallback function that delegates calls to the address returned by `_implementation()`. Will run if call data
     * is empty.
     */
    receive () external payable {
        _fallback();
    }

    /**
     * @dev Hook that is called before falling back to the implementation. Can happen as part of a manual `_fallback`
     * call, or as part of the Solidity `fallback` or `receive` functions.
     * 
     * If overriden should call `super._beforeFallback()`.
     */
    function _beforeFallback() internal virtual {
    }
}


// File @openzeppelin/contracts/utils/Address.sol@v3.3.0


pragma solidity >=0.6.2 <0.8.0;

/**
 * @dev Collection of functions related to the address type
 */
library Address {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize, which returns 0 for contracts in
        // construction, since the code is only stored at the end of the
        // constructor execution.

        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly { size := extcodesize(account) }
        return size > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://diligence.consensys.net/posts/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.5.11/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        // solhint-disable-next-line avoid-low-level-calls, avoid-call-value
        (bool success, ) = recipient.call{ value: amount }("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain`call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
      return functionCall(target, data, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data, string memory errorMessage) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value, string memory errorMessage) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        require(isContract(target), "Address: call to non-contract");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.call{ value: value }(data);
        return _verifyCallResult(success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data, string memory errorMessage) internal view returns (bytes memory) {
        require(isContract(target), "Address: static call to non-contract");

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.staticcall(data);
        return _verifyCallResult(success, returndata, errorMessage);
    }

    function _verifyCallResult(bool success, bytes memory returndata, string memory errorMessage) private pure returns(bytes memory) {
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }
}


// File @openzeppelin/contracts/proxy/UpgradeableProxy.sol@v3.3.0


pragma solidity >=0.6.0 <0.8.0;


/**
 * @dev This contract implements an upgradeable proxy. It is upgradeable because calls are delegated to an
 * implementation address that can be changed. This address is stored in storage in the location specified by
 * https://eips.ethereum.org/EIPS/eip-1967[EIP1967], so that it doesn't conflict with the storage layout of the
 * implementation behind the proxy.
 * 
 * Upgradeability is only provided internally through {_upgradeTo}. For an externally upgradeable proxy see
 * {TransparentUpgradeableProxy}.
 */
contract UpgradeableProxy is Proxy {
    /**
     * @dev Initializes the upgradeable proxy with an initial implementation specified by `_logic`.
     * 
     * If `_data` is nonempty, it's used as data in a delegate call to `_logic`. This will typically be an encoded
     * function call, and allows initializating the storage of the proxy like a Solidity constructor.
     */
    constructor(address _logic, bytes memory _data) public payable {
        assert(_IMPLEMENTATION_SLOT == bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1));
        _setImplementation(_logic);
        if(_data.length > 0) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool success,) = _logic.delegatecall(_data);
            require(success);
        }
    }

    /**
     * @dev Emitted when the implementation is upgraded.
     */
    event Upgraded(address indexed implementation);

    /**
     * @dev Storage slot with the address of the current implementation.
     * This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 private constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    /**
     * @dev Returns the current implementation address.
     */
    function _implementation() internal override view returns (address impl) {
        bytes32 slot = _IMPLEMENTATION_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            impl := sload(slot)
        }
    }

    /**
     * @dev Upgrades the proxy to a new implementation.
     * 
     * Emits an {Upgraded} event.
     */
    function _upgradeTo(address newImplementation) internal {
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    /**
     * @dev Stores a new address in the EIP1967 implementation slot.
     */
    function _setImplementation(address newImplementation) private {
        require(Address.isContract(newImplementation), "UpgradeableProxy: new implementation is not a contract");

        bytes32 slot = _IMPLEMENTATION_SLOT;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, newImplementation)
        }
    }
}


// File @openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol@v3.3.0


pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev This contract implements a proxy that is upgradeable by an admin.
 * 
 * To avoid https://medium.com/nomic-labs-blog/malicious-backdoors-in-ethereum-proxies-62629adf3357[proxy selector
 * clashing], which can potentially be used in an attack, this contract uses the
 * https://blog.openzeppelin.com/the-transparent-proxy-pattern/[transparent proxy pattern]. This pattern implies two
 * things that go hand in hand:
 * 
 * 1. If any account other than the admin calls the proxy, the call will be forwarded to the implementation, even if
 * that call matches one of the admin functions exposed by the proxy itself.
 * 2. If the admin calls the proxy, it can access the admin functions, but its calls will never be forwarded to the
 * implementation. If the admin tries to call a function on the implementation it will fail with an error that says
 * "admin cannot fallback to proxy target".
 * 
 * These properties mean that the admin account can only be used for admin actions like upgrading the proxy or changing
 * the admin, so it's best if it's a dedicated account that is not used for anything else. This will avoid headaches due
 * to sudden errors when trying to call a function from the proxy implementation.
 * 
 * Our recommendation is for the dedicated account to be an instance of the {ProxyAdmin} contract. If set up this way,
 * you should think of the `ProxyAdmin` instance as the real administrative interface of your proxy.
 */
contract TransparentUpgradeableProxy is UpgradeableProxy {
    /**
     * @dev Initializes an upgradeable proxy managed by `_admin`, backed by the implementation at `_logic`, and
     * optionally initialized with `_data` as explained in {UpgradeableProxy-constructor}.
     */
    constructor(address _logic, address admin_, bytes memory _data) public payable UpgradeableProxy(_logic, _data) {
        assert(_ADMIN_SLOT == bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1));
        _setAdmin(admin_);
    }

    /**
     * @dev Emitted when the admin account has changed.
     */
    event AdminChanged(address previousAdmin, address newAdmin);

    /**
     * @dev Storage slot with the admin of the contract.
     * This is the keccak-256 hash of "eip1967.proxy.admin" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 private constant _ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    /**
     * @dev Modifier used internally that will delegate the call to the implementation unless the sender is the admin.
     */
    modifier ifAdmin() {
        if (msg.sender == _admin()) {
            _;
        } else {
            _fallback();
        }
    }

    /**
     * @dev Returns the current admin.
     * 
     * NOTE: Only the admin can call this function. See {ProxyAdmin-getProxyAdmin}.
     * 
     * TIP: To get this value clients can read directly from the storage slot shown below (specified by EIP1967) using the
     * https://eth.wiki/json-rpc/API#eth_getstorageat[`eth_getStorageAt`] RPC call.
     * `0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`
     */
    function admin() external ifAdmin returns (address admin_) {
        admin_ = _admin();
    }

    /**
     * @dev Returns the current implementation.
     * 
     * NOTE: Only the admin can call this function. See {ProxyAdmin-getProxyImplementation}.
     * 
     * TIP: To get this value clients can read directly from the storage slot shown below (specified by EIP1967) using the
     * https://eth.wiki/json-rpc/API#eth_getstorageat[`eth_getStorageAt`] RPC call.
     * `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`
     */
    function implementation() external ifAdmin returns (address implementation_) {
        implementation_ = _implementation();
    }

    /**
     * @dev Changes the admin of the proxy.
     * 
     * Emits an {AdminChanged} event.
     * 
     * NOTE: Only the admin can call this function. See {ProxyAdmin-changeProxyAdmin}.
     */
    function changeAdmin(address newAdmin) external ifAdmin {
        require(newAdmin != address(0), "TransparentUpgradeableProxy: new admin is the zero address");
        emit AdminChanged(_admin(), newAdmin);
        _setAdmin(newAdmin);
    }

    /**
     * @dev Upgrade the implementation of the proxy.
     * 
     * NOTE: Only the admin can call this function. See {ProxyAdmin-upgrade}.
     */
    function upgradeTo(address newImplementation) external ifAdmin {
        _upgradeTo(newImplementation);
    }

    /**
     * @dev Upgrade the implementation of the proxy, and then call a function from the new implementation as specified
     * by `data`, which should be an encoded function call. This is useful to initialize new storage variables in the
     * proxied contract.
     * 
     * NOTE: Only the admin can call this function. See {ProxyAdmin-upgradeAndCall}.
     */
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable ifAdmin {
        _upgradeTo(newImplementation);
        // solhint-disable-next-line avoid-low-level-calls
        (bool success,) = newImplementation.delegatecall(data);
        require(success);
    }

    /**
     * @dev Returns the current admin.
     */
    function _admin() internal view returns (address adm) {
        bytes32 slot = _ADMIN_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            adm := sload(slot)
        }
    }

    /**
     * @dev Stores a new address in the EIP1967 admin slot.
     */
    function _setAdmin(address newAdmin) private {
        bytes32 slot = _ADMIN_SLOT;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, newAdmin)
        }
    }

    /**
     * @dev Makes sure the admin cannot access the fallback function. See {Proxy-_beforeFallback}.
     */
    function _beforeFallback() internal override virtual {
        require(msg.sender != _admin(), "TransparentUpgradeableProxy: admin cannot fallback to proxy target");
        super._beforeFallback();
    }
}


// File @openzeppelin/contracts/proxy/ProxyAdmin.sol@v3.3.0


pragma solidity >=0.6.0 <0.8.0;


/**
 * @dev This is an auxiliary contract meant to be assigned as the admin of a {TransparentUpgradeableProxy}. For an
 * explanation of why you would want to use this see the documentation for {TransparentUpgradeableProxy}.
 */
contract ProxyAdmin is Ownable {

    /**
     * @dev Returns the current implementation of `proxy`.
     * 
     * Requirements:
     * 
     * - This contract must be the admin of `proxy`.
     */
    function getProxyImplementation(TransparentUpgradeableProxy proxy) public view returns (address) {
        // We need to manually run the static call since the getter cannot be flagged as view
        // bytes4(keccak256("implementation()")) == 0x5c60da1b
        (bool success, bytes memory returndata) = address(proxy).staticcall(hex"5c60da1b");
        require(success);
        return abi.decode(returndata, (address));
    }

    /**
     * @dev Returns the current admin of `proxy`.
     * 
     * Requirements:
     * 
     * - This contract must be the admin of `proxy`.
     */
    function getProxyAdmin(TransparentUpgradeableProxy proxy) public view returns (address) {
        // We need to manually run the static call since the getter cannot be flagged as view
        // bytes4(keccak256("admin()")) == 0xf851a440
        (bool success, bytes memory returndata) = address(proxy).staticcall(hex"f851a440");
        require(success);
        return abi.decode(returndata, (address));
    }

    /**
     * @dev Changes the admin of `proxy` to `newAdmin`.
     * 
     * Requirements:
     * 
     * - This contract must be the current admin of `proxy`.
     */
    function changeProxyAdmin(TransparentUpgradeableProxy proxy, address newAdmin) public onlyOwner {
        proxy.changeAdmin(newAdmin);
    }

    /**
     * @dev Upgrades `proxy` to `implementation`. See {TransparentUpgradeableProxy-upgradeTo}.
     * 
     * Requirements:
     * 
     * - This contract must be the admin of `proxy`.
     */
    function upgrade(TransparentUpgradeableProxy proxy, address implementation) public onlyOwner {
        proxy.upgradeTo(implementation);
    }

    /**
     * @dev Upgrades `proxy` to `implementation` and calls a function on the new implementation. See
     * {TransparentUpgradeableProxy-upgradeToAndCall}.
     * 
     * Requirements:
     * 
     * - This contract must be the admin of `proxy`.
     */
    function upgradeAndCall(TransparentUpgradeableProxy proxy, address implementation, bytes memory data) public payable onlyOwner {
        proxy.upgradeToAndCall{value: msg.value}(implementation, data);
    }
}


// File @openzeppelin/contracts/math/SafeMath.sol@v3.3.0


pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}


// File @uniswap/v2-periphery/contracts/interfaces/IWETH.sol@v1.1.0-beta.0

pragma solidity >=0.5.0;

interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
}


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v3.3.0


pragma solidity >=0.6.0 <0.8.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}


// File contracts/interfaces/IStrategyToken.sol

pragma solidity 0.6.12;

interface IStrategyToken is IERC20 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function nonces(address owner) external view returns (uint256);
}


// File contracts/interfaces/IStrategy.sol

pragma solidity 0.6.12;

interface IStrategy is IStrategyToken {
    function approveToken(
        IERC20 token,
        address account,
        uint256 amount
    ) external;

    function approveTokens(address account, uint256 amount) external;

    function transferToken(
        IERC20 token,
        address account,
        uint256 amount
    ) external;

    function setStructure(address[] memory newItems, uint256[] memory newPercentages) external;

    function withdraw(uint256 amount) external;

    function mint(address account, uint256 amount) external;

    function burn(address account, uint256 amount) external;

    function updateManager(address newManager) external;

    function items() external view returns (address[] memory);

    function percentage(address token) external view returns (uint256);

    function isWhitelisted(address account) external view returns (bool);

    function controller() external view returns (address);

    function manager() external view returns (address);

    function oracle() external view returns (address);

    function whitelist() external view returns (address);

    function verifyStructure(address[] memory newTokens, uint256[] memory newPercentages)
        external
        pure
        returns (bool);
}


// File contracts/interfaces/IStrategyRouter.sol

pragma solidity 0.6.12;

interface IStrategyRouter {
    //address public weth;
    //function deposit(address depositor, address[] memory tokens, address[] memory routers) external payable;
    //function withdraw(address withdrawer, uint256 amount) external;

    function sellTokens(
        address strategy,
        address[] memory tokens,
        address[] memory routers
    ) external;

    function buyTokens(
        address strategy,
        address[] memory tokens,
        address[] memory routers
    ) external;

    function rebalance(address strategy, bytes calldata data) external;

    function deposit(address strategy, bytes calldata data) external;

    function controller() external view returns (address);

    function weth() external view returns (address);
}


// File contracts/interfaces/IStrategyController.sol

pragma solidity 0.6.12;


interface IStrategyController {
    function setupStrategy(
        address manager_,
        address strategy_,
        bool social_,
        uint256 fee_,
        uint256 threshold_,
        uint256 slippage_,
        uint256 timelock_,
        address router_,
        bytes memory data_
    ) external payable;

    function rebalance(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external;

    function deposit(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external payable;

    function withdrawAssets(IStrategy strategy, uint256 amount) external;

    function withdrawPerformanceFee(IStrategy strategy) external;

    function restructure(
        IStrategy strategy,
        address[] memory tokens,
        uint256[] memory percentages
    ) external;

    function finalizeStructure(
        IStrategy strategy,
        address router,
        address[] memory sellAdapters,
        address[] memory buyAdapters
    ) external;

    function updateValue(
        IStrategy strategy,
        uint256 categoryIndex,
        uint256 newValue
    ) external;

    function finalizeValue(address strategy) external;

    function openStrategy(IStrategy strategy, uint256 fee) external;

    function social(address strategy) external view returns (bool);

    function rebalanceThreshold(address strategy) external view returns (uint256);

    function slippage(address strategy) external view returns (uint256);

    function timelock(address strategy) external view returns (uint256);
}


// File contracts/interfaces/IOracle.sol

pragma solidity 0.6.12;

interface IOracle {
    function update(address token) external;

    function weth() external view returns (address);

    function consult(uint256 amount, address input) external view returns (uint256);

    function estimateTotal(address account, address[] memory tokens)
        external
        view
        returns (uint256, uint256[] memory);
}


// File contracts/StrategyControllerStorage.sol

pragma solidity 0.6.12;

contract StrategyControllerStorage {
    // ALERT: Do not reorder variables on upgrades! Append only
    enum TimelockCategory {RESTRUCTURE, THRESHOLD, SLIPPAGE, TIMELOCK}

    struct StrategyState {
        bool social;
        uint256 performanceFee;
        uint256 rebalanceThreshold;
        uint256 slippage;
        uint256 timelock;
    }

    /**
        @notice A time lock requirement for changing the state of this Strategy
        @dev WARNING: Only one TimelockCategory can be pending at a time
    */
    struct Timelock {
        TimelockCategory category;
        uint256 timestamp;
        bytes data;
    }

    // Reentrancy guard
    bool internal _locked;

    mapping(address => bool) internal _initialized;
    mapping(address => uint256) internal _lastTokenValues;
    mapping(address => StrategyState) internal _strategyStates;
    mapping(address => Timelock) internal _timelocks;

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}


// File contracts/StrategyController.sol

pragma solidity 0.6.12;





/**
 * @notice This contract controls multiple Strategy contracts.
 * @dev Whitelisted routers are able to execute different swapping strategies as long as total strategy value doesn't drop below the defined slippage amount
 * @dev To avoid someone from repeatedly skimming off this slippage value, threshold should be set sufficiently high
 */
contract StrategyController is IStrategyController, StrategyControllerStorage {
    using SafeMath for uint256;

    uint256 private constant DIVISOR = 1000;

    event RebalanceCalled(address indexed strategy, uint256 total, address caller);
    event Deposit(address indexed strategy, uint256 value, uint256 amount);
    event Withdraw(address indexed strategy, uint256 amount, uint256[] amounts);
    event NewStructure(address indexed strategy, address[] tokens, uint256[] percentages, bool indexed finalized);
    event NewValue(address indexed strategy, TimelockCategory category, uint256 newValue, bool indexed finalized);

    /**
     * @dev Called during the creation of a new Strategy proxy (see: StrategyProxyFactory.createStrategy())
     * @param creator_ The address that created the strategy
     * @param strategy_ The address of the strategy
     * @param social_ Is the strategy open to others?
     * @param fee_ Strategy performance fee
     * @param threshold_ The percentage out of balance a token must be before it can be rebalanced
     * @param slippage_ The percentage away from 100% that the total can slip during rebalance due to fees
     * @param timelock_ The amount of time between initializing a restructure and updating the strategy
     * @param router_ The router in charge of swapping items for this strategy
     * @param data_ Encoded values parsed by the different routers to execute swaps
     */
    function setupStrategy(
        address creator_,
        address strategy_,
        bool social_,
        uint256 fee_,
        uint256 threshold_,
        uint256 slippage_,
        uint256 timelock_,
        address router_,
        bytes memory data_
    ) external payable override {
        _setLock();
        require(_initialized[strategy_] == false, "Already setup");
        require(threshold_ <= DIVISOR && slippage_ <= DIVISOR, "Slippage/threshold high");
        _initialized[strategy_] = true;
        // Set globals
        StrategyState storage strategyState = _strategyStates[strategy_];
        strategyState.rebalanceThreshold = threshold_;
        strategyState.slippage = slippage_;
        strategyState.timelock = timelock_;
        IStrategy strategy = IStrategy(strategy_);
        if (msg.value > 0) {
            address weth = IOracle(strategy.oracle()).weth();
            IWETH(weth).deposit{value: msg.value}();
            IERC20(weth).approve(router_, msg.value);
            IStrategyRouter(router_).deposit(strategy_, data_);
            require(IERC20(weth).balanceOf(address(this)) == uint256(0), "Leftover funds");
            IERC20(weth).approve(router_, 0);
            strategy.mint(creator_, msg.value);
        }
        if (social_) {
          _openStrategy(strategy, fee_);
        }
        _removeLock();
    }

    /**
     * @notice Rebalance the strategy to match the current structure
     * @dev The calldata that gets passed to this function can differ depending on which router is being used
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data Calldata that gets passed the the router's rebalance function
     */
    function rebalance(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external override {
        _setLock();
        _onlyApproved(strategy, address(router));
        _onlyManager(strategy);
        (uint256 totalBefore, bool balancedBefore) = _verifyBalance(strategy);
        require(!balancedBefore, "Balanced");
        _approveTokens(strategy, address(router), uint256(-1));
        _rebalance(strategy, router, totalBefore, data);
        _approveTokens(strategy, address(router), uint256(0));
        _removeLock();
    }

    /**
     * @notice Deposit ether, which is traded for the underlying assets, and mint strategy tokens
     * @param strategy The strategy being deposited to
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data The calldata for the router's deposit function
     */
    function deposit(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external payable override {
        _setLock();
        _onlyApproved(strategy, address(router));
        _socialOrManager(strategy);
        (uint256 totalBefore, ) =
            IOracle(strategy.oracle()).estimateTotal(address(strategy), strategy.items());

        if (msg.value > 0) {
          address weth = IOracle(strategy.oracle()).weth();
          IWETH(weth).deposit{value: msg.value}();
          IERC20(weth).approve(address(router), msg.value);
          router.deposit(address(strategy), data);
          IERC20(weth).approve(address(router), 0);
          require(IERC20(weth).balanceOf(address(this)) == uint256(0), "Leftover funds");
        }  else {
          router.deposit(address(strategy), data);
        }

        // Recheck total
        (uint256 totalAfter, ) =
            IOracle(strategy.oracle()).estimateTotal(address(strategy), strategy.items());
        require(totalAfter > totalBefore, "Lost value");
        uint256 valueAdded = totalAfter - totalBefore; // Safe math not needed, already checking for underflow
        uint256 totalSupply = strategy.totalSupply();
        uint256 relativeTokens =
            totalSupply > 0 ? totalSupply.mul(valueAdded).div(totalAfter) : totalAfter;
        strategy.mint(msg.sender, relativeTokens);
        emit Deposit(address(strategy), msg.value, relativeTokens);
        _removeLock();
    }

    /**
     * @notice Withdraw the underlying assets and burn the equivalent amount of strategy token
     * @param strategy The strategy that will be withdrawn from
     * @param amount The amount of strategy items to burn to recover the equivalent underlying assets
     */
    function withdrawAssets(IStrategy strategy, uint256 amount) external override {
        _setLock();
        require(amount > 0, "0 amount");
        uint256 percentage = amount.mul(10**18).div(strategy.totalSupply());
        strategy.burn(msg.sender, amount);
        address[] memory tokens = strategy.items();
        uint256[] memory amounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            // Should not be possible to have address(0) since the Strategy will check for it
            IERC20 token = IERC20(tokens[i]);
            uint256 currentBalance = token.balanceOf(address(strategy));
            uint256 tokenAmount = currentBalance.mul(percentage).div(10**18);
            strategy.transferToken(token, msg.sender, tokenAmount);
            amounts[i] = tokenAmount;
        }
        emit Withdraw(address(strategy), amount, amounts);
        _removeLock();
    }

    /**
     * @notice Manager can withdraw their performance fee here
     * @param strategy The strategy that will be withdrawn from
     */
    function withdrawPerformanceFee(IStrategy strategy) external override {
        _setLock();
        _onlyManager(strategy);
        (uint256 total, ) =
            IOracle(strategy.oracle()).estimateTotal(address(strategy), strategy.items());
        uint256 totalSupply = strategy.totalSupply();
        uint256 tokenValue = total.mul(10**18).div(totalSupply);
        require(tokenValue > _lastTokenValues[address(strategy)], "No earnings");
        uint256 diff = tokenValue.sub(_lastTokenValues[address(strategy)]);
        uint256 performanceFee = _strategyStates[address(strategy)].performanceFee;
        uint256 reward = totalSupply.mul(diff).mul(performanceFee).div(DIVISOR).div(10**18);
        _lastTokenValues[address(strategy)] = tokenValue;
        strategy.mint(msg.sender, reward); // _onlyManager() ensures that msg.sender == manager
        _removeLock();
    }

    /**
     * @notice Initiate a restructure of the strategy items. This gives users a chance to withdraw before restructure
     * @dev We store the new structure as a bytes32 hash and then check that the
            values are correct when finalizeStructure is called.
     * @param strategyItems An array of token addresses that will comprise the strategy
     * @param percentages An array of percentages for each token in the above array. Must total 100%
     */
    function restructure(
        IStrategy strategy,
        address[] memory strategyItems,
        uint256[] memory percentages
    ) external override {
        _setLock();
        _onlyManager(strategy);
        Timelock storage lock = _timelocks[address(strategy)];
        require(
            lock.timestamp == 0 ||
                block.timestamp >
                lock.timestamp.add(_strategyStates[address(strategy)].timelock),
            "Timelock active"
        );
        strategy.verifyStructure(strategyItems, percentages);
        lock.category = TimelockCategory.RESTRUCTURE;
        lock.timestamp = block.timestamp;
        lock.data = abi.encode(strategyItems, percentages);

        emit NewStructure(address(strategy), strategyItems, percentages, false);
        _removeLock();
    }

    /**
     * @notice Finalize a restructure by setting the new values and trading the strategyItems
     * @dev We confirm that the same structure is sent by checking the bytes32 hash against _restructureProof
     * @param sellAdapters An array of adapters for each sale of the current strategyItems
     * @param buyAdapters An array of adapters for each purchase of the new strategyItems
     * @param router The address of the router that will be doing the handling the trading logic
     */
    function finalizeStructure(
        IStrategy strategy,
        address router,
        address[] memory sellAdapters,
        address[] memory buyAdapters
    ) external override {
        _setLock();
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        Timelock storage lock = _timelocks[address(strategy)];
        require(
            !strategyState.social ||
                block.timestamp > lock.timestamp.add(strategyState.timelock),
            "Timelock active"
        );
        require(lock.category == TimelockCategory.RESTRUCTURE, "Wrong category");
        (address[] memory strategyItems, uint256[] memory percentages) =
            abi.decode(lock.data, (address[], uint256[]));
        _finalizeStructure(strategy, router, strategyItems, percentages, sellAdapters, buyAdapters);
        delete lock.category;
        delete lock.timestamp;
        delete lock.data;
        emit NewStructure(address(strategy), strategyItems, percentages, true);
        _removeLock();
    }

    function updateValue(
        IStrategy strategy,
        uint256 categoryIndex,
        uint256 newValue
    ) external override {
        _setLock();
        _onlyManager(strategy);
        Timelock storage lock = _timelocks[address(strategy)];
        require(
            lock.timestamp == 0 ||
                block.timestamp >
                lock.timestamp.add(_strategyStates[address(strategy)].timelock),
            "Timelock active"
        );
        TimelockCategory category = TimelockCategory(categoryIndex);
        require(category != TimelockCategory.RESTRUCTURE);
        if (category != TimelockCategory.TIMELOCK)
            require(newValue <= DIVISOR, "Value too high");
        lock.category = category;
        lock.timestamp = block.timestamp;
        lock.data = abi.encode(newValue);
        emit NewValue(address(strategy), category, newValue, false);
        _removeLock();
    }

    function finalizeValue(address strategy) external override {
        _setLock();
        StrategyState storage strategyState = _strategyStates[strategy];
        Timelock storage lock = _timelocks[strategy];
        require(lock.category != TimelockCategory.RESTRUCTURE, "Wrong category");
        require(
            !strategyState.social ||
                block.timestamp > lock.timestamp.add(strategyState.timelock),
            "Timelock active"
        );
        uint256 newValue = abi.decode(lock.data, (uint256));
        if (lock.category == TimelockCategory.THRESHOLD) {
            strategyState.rebalanceThreshold = newValue;
        } else if (lock.category == TimelockCategory.SLIPPAGE) {
            strategyState.slippage = newValue;
        } else { //Only possible option is TimelockCategory.TIMELOCK
            strategyState.timelock = newValue;
        }
        emit NewValue(strategy, lock.category, newValue, true);
        delete lock.category;
        delete lock.timestamp;
        delete lock.data;
        _removeLock();
    }

    /**
     * @notice Setter to change strategy to social. Cannot be undone.
     * @dev A social profile allows other users to deposit and rebalance the strategy
     */
    function openStrategy(IStrategy strategy, uint256 fee) external override {
        _setLock();
        _onlyManager(strategy);
        _openStrategy(strategy, fee);
        _removeLock();
    }

    /**
     * @notice Social bool getter
     * @dev This value determines whether other account may deposit into this strategy
     */
    function social(address strategy) external view override returns (bool) {
        return _strategyStates[strategy].social;
    }

    /**
     * @notice Rebalance threshold getter
     */
    function rebalanceThreshold(address strategy) external view override returns (uint256) {
        return _strategyStates[strategy].rebalanceThreshold;
    }

    /**
     * @notice Slippage getter
     */
    function slippage(address strategy) external view override returns (uint256) {
        return _strategyStates[strategy].slippage;
    }

    /**
     * @notice Timelock getter
     */
    function timelock(address strategy) external view override returns (uint256) {
        return _strategyStates[strategy].timelock;
    }

    // Internal Strategy Functions
    /**
     * @notice Rebalance the strategy to match the current structure
     * @dev The calldata that gets passed to this function can differ depending on which router is being used
     * @param totalBefore The valuation of the strategy before rebalance
     * @param data Calldata that gets passed the the router's rebalance function
     * @param router The address of the router that will be doing the handling the trading logic
     */
    function _rebalance(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 totalBefore,
        bytes memory data
    ) internal returns (uint256) {
        router.rebalance(address(strategy), data);
        // Recheck total
        (uint256 totalAfter, bool balancedAfter) = _verifyBalance(strategy);
        require(balancedAfter, "Not balanced");
        require(
            totalAfter >=
                totalBefore.mul(_strategyStates[address(strategy)].slippage).div(DIVISOR),
            "Value slipped"
        );
        emit RebalanceCalled(address(strategy), totalAfter, msg.sender);
        return totalAfter;
    }

    function _openStrategy(IStrategy strategy, uint256 fee) internal {
        require(fee < DIVISOR, "Fee too high");
        (uint256 total, ) =
            IOracle(strategy.oracle()).estimateTotal(address(strategy), strategy.items());
        //As token value increase compared to the _tokenValueLast value, performance fees may be extracted
        _lastTokenValues[address(strategy)] = total.mul(10**18).div(strategy.totalSupply());
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        strategyState.performanceFee = fee;
        strategyState.social = true;
    }

    /**
     * @notice This function gets the strategy value from the oracle and checks
     *         whether the strategy is balanced. Necessary to confirm the balance
     *         before and after a rebalance to ensure nothing fishy happened
     */
    function _verifyBalance(IStrategy strategy) internal view returns (uint256, bool) {
        address[] memory strategyItems = strategy.items();
        (uint256 total, uint256[] memory estimates) =
            IOracle(strategy.oracle()).estimateTotal(address(strategy), strategyItems);
        bool balanced = true;
        for (uint256 i = 0; i < strategyItems.length; i++) {
            uint256 expectedValue = total.mul(strategy.percentage(strategyItems[i])).div(DIVISOR);
            uint256 rebalanceRange =
                expectedValue.mul(_strategyStates[address(strategy)].rebalanceThreshold).div(
                    DIVISOR
                );
            if (estimates[i] > expectedValue.add(rebalanceRange)) {
                balanced = false;
                break;
            }
            if (estimates[i] < expectedValue.sub(rebalanceRange)) {
                balanced = false;
                break;
            }
        }
        return (total, balanced);
    }

    /**
     * @notice Finalize the structure by selling current posiition, setting new structure, and buying new position
     * @param strategyItems An array of token addresses that will comprise the strategy
     * @param percentages An array of percentages for each token in the above array. Must total 100%
     * @param sellAdapters An array of adapters for each sale of the current strategyItems
     * @param buyAdapters An array of adapters for each purchase of the new strategyItems
     * @param router The address of the router that will be doing the handling the trading logic
     */
    function _finalizeStructure(
        IStrategy strategy,
        address router,
        address[] memory strategyItems,
        uint256[] memory percentages,
        address[] memory sellAdapters,
        address[] memory buyAdapters
    ) internal {
        address[] memory oldTokens = strategy.items();
        require(sellAdapters.length == oldTokens.length, "Sell adapters length");
        require(buyAdapters.length == strategyItems.length, "Buy adapters length");
        _approveTokens(strategy, router, uint256(-1));
        // Reset all values and return items to ETH
        IStrategyRouter(router).sellTokens(address(strategy), oldTokens, sellAdapters);
        _approveTokens(strategy, router, uint256(0));
        // Set new structure
        strategy.setStructure(strategyItems, percentages);
        // Since tokens have already been minted we don"t do router.deposit, instead use router.convert
        IERC20 weth = IERC20(IOracle(strategy.oracle()).weth());
        weth.approve(router, uint(-1));
        IStrategyRouter(router).buyTokens(
            address(strategy),
            strategyItems,
            buyAdapters
        );
        weth.approve(router, 0);
    }

    /**
     * @notice Batch approve tokens
     * @param spender The address that will be approved to spend tokens
     * @param amount The amount the each token will be approved for
     */
    function _approveTokens(
        IStrategy strategy,
        address spender,
        uint256 amount
    ) internal {
        strategy.approveTokens(spender, amount);
        address weth = IOracle(strategy.oracle()).weth();
        if (strategy.percentage(weth) == 0) {
            //Approving is still needed as we need to transfer weth for rebalancing
            strategy.approveToken(IERC20(weth), spender, amount);
        }
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(IStrategy strategy, address router) internal view {
        require(strategy.isWhitelisted(router), "Router not approved");
    }

    function _onlyManager(IStrategy strategy) internal view {
        require(msg.sender == strategy.manager(), "Not manager");
    }

    /**
     * @notice Checks if strategy is social or else require msg.sender is manager
     */
    function _socialOrManager(IStrategy strategy) internal view {
        require(
            msg.sender == strategy.manager() || _strategyStates[address(strategy)].social,
            "Not manager"
        );
    }

    /**
     * @notice Sets Reentrancy guard
     */
    function _setLock() internal {
        require(!_locked, "No Reentrancy");
        _locked = true;
    }

    /**
     * @notice Removes reentrancy guard.
     */
    function _removeLock() internal {
        _locked = false;
    }
}


// File contracts/StrategyControllerAdmin.sol

pragma solidity 0.6.12;


/**
 * @notice Deploys Controller Proxy
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract StrategyControllerAdmin is ProxyAdmin {
    address public controller;

    constructor() public {
        StrategyController implementation = new StrategyController();
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy(address(implementation), address(this), new bytes(0));
        controller = address(proxy);
    }
}


// File @openzeppelin/contracts/proxy/Initializable.sol@v3.3.0


// solhint-disable-next-line compiler-version
pragma solidity >=0.4.24 <0.8.0;


/**
 * @dev This is a base contract to aid in writing upgradeable contracts, or any kind of contract that will be deployed
 * behind a proxy. Since a proxied contract can't have a constructor, it's common to move constructor logic to an
 * external initializer function, usually called `initialize`. It then becomes necessary to protect this initializer
 * function so it can only be called once. The {initializer} modifier provided by this contract will have this effect.
 * 
 * TIP: To avoid leaving the proxy in an uninitialized state, the initializer function should be called as early as
 * possible by providing the encoded function call as the `_data` argument to {UpgradeableProxy-constructor}.
 * 
 * CAUTION: When used with inheritance, manual care must be taken to not invoke a parent initializer twice, or to ensure
 * that all initializers are idempotent. This is not verified automatically as constructors are by Solidity.
 */
abstract contract Initializable {

    /**
     * @dev Indicates that the contract has been initialized.
     */
    bool private _initialized;

    /**
     * @dev Indicates that the contract is in the process of being initialized.
     */
    bool private _initializing;

    /**
     * @dev Modifier to protect an initializer function from being invoked twice.
     */
    modifier initializer() {
        require(_initializing || _isConstructor() || !_initialized, "Initializable: contract is already initialized");

        bool isTopLevelCall = !_initializing;
        if (isTopLevelCall) {
            _initializing = true;
            _initialized = true;
        }

        _;

        if (isTopLevelCall) {
            _initializing = false;
        }
    }

    /// @dev Returns true if and only if the function is running in the constructor
    function _isConstructor() private view returns (bool) {
        // extcodesize checks the size of the code stored in an address, and
        // address returns the current address. Since the code is still not
        // deployed when running a constructor, any checks on its code size will
        // yield zero, making it an effective way to detect if a contract is
        // under construction or not.
        address self = address(this);
        uint256 cs;
        // solhint-disable-next-line no-inline-assembly
        assembly { cs := extcodesize(self) }
        return cs == 0;
    }
}


// File contracts/StrategyProxyFactoryStorage.sol

pragma solidity 0.6.12;


contract StrategyProxyFactoryStorage {
    address public _owner;
    address public _controller;
    address public _whitelist;
    address public _oracle;
    address public _implementation;
    uint256 public _version;
}


// File contracts/StrategyProxyManagerRegistry.sol

pragma solidity 0.6.12;

interface IStrategyManager {
    function manager() external view returns (address);
}

contract StrategyProxyManagerRegistry {
    address private immutable proxyFactory;

    constructor(address proxyFactory_) public {
        proxyFactory = proxyFactory_;
    }

    function manager(address proxy) external view returns (address) {
        return IStrategyManager(proxy).manager();
    }
}


// File contracts/interfaces/IStrategyProxyFactory.sol

pragma solidity 0.6.12;

interface IStrategyProxyFactory {
    function implementation() external view returns (address);

    function controller() external view returns (address);

    function oracle() external view returns (address);

    function whitelist() external view returns (address);

    function version() external view returns (uint256);

    function salt(address manager, string memory name, string memory symbol) external pure returns (bytes32);

    function createStrategy(
        address manager,
        string memory name,
        string memory symbol,
        address[] memory tokens,
        uint256[] memory percentages,
        bool social,
        uint256 fee,
        uint256 threshold,
        uint256 slippage,
        uint256 timelock,
        address router,
        bytes memory data
    ) external payable returns (address);
}


// File contracts/StrategyProxyFactory.sol

pragma solidity 0.6.12;






/**
 * @notice Deploys Proxy Strategies
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract StrategyProxyFactory is IStrategyProxyFactory, StrategyProxyFactoryStorage, Initializable {
    StrategyProxyManagerRegistry private immutable managerRegistry;

    /**
     * @notice Log the address of an implementation contract update
     */
    event Update(address newImplementation, uint256 version);

    /**
     * @notice Log the creation of a new strategy
     */
    event NewStrategy(
        address strategy,
        address manager,
        string name,
        string symbol,
        address[] tokens,
        uint256[] percentages,
        bool social,
        uint256 fee,
        uint256 threshold,
        uint256 slippage,
        uint256 timelock
    );

    /**
     * @notice Log the new Oracle for the strategys
     */
    event NewOracle(address newOracle);

    /**
     * @notice New default whitelist address
     */
    event NewWhitelist(address newWhitelist);

    /**
     * @notice Log ownership transfer
     */
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @notice Initialize constructor to disable implementation
     */
    constructor() public initializer {
        managerRegistry = new StrategyProxyManagerRegistry(address(this));
    }

    function initialize(
        address owner_,
        address implementation_,
        address controller_,
        address oracle_,
        address whitelist_
    ) external initializer returns (bool){
        _owner = owner_;
        _implementation = implementation_;
        _controller = controller_;
        _oracle = oracle_;
        _whitelist = whitelist_;
        _version = 1;
        emit Update(_implementation, _version);
        emit NewOracle(_oracle);
        emit NewWhitelist(_whitelist);
        emit OwnershipTransferred(address(0), _owner);
        return true;
    }

    modifier onlyManager(address proxy) {
        require(managerRegistry.manager(proxy) == msg.sender, "Not manager");
        _;
    }

    modifier onlyOwner() {
        require(_owner == msg.sender, "Not owner");
        _;
    }

    /**
        @notice Entry point for creating new Strategies.
        @notice Creates a new proxy for the current implementation and initializes the strategy with the provided input
        @dev Can send ETH with this call to automatically deposit items into the strategy
    */
    function createStrategy(
        address manager,
        string memory name,
        string memory symbol,
        address[] memory tokens,
        uint256[] memory percentages,
        bool social,
        uint256 fee,
        uint256 threshold,
        uint256 slippage,
        uint256 timelock,
        address router,
        bytes memory data
    ) external payable override returns (address){
        address strategy = _createProxy(manager, name, symbol, tokens, percentages);
        _setupStrategy(
           manager,
           strategy,
           social,
           fee,
           threshold,
           slippage,
           timelock,
           router,
           data
        );
        emit NewStrategy(
            strategy,
            manager,
            name,
            symbol,
            tokens,
            percentages,
            social,
            fee,
            threshold,
            slippage,
            timelock
        );
        return strategy;
    }

    function updateImplementation(address newImplementation) external onlyOwner {
        _implementation = newImplementation;
        _version++;
        emit Update(newImplementation, _version);
    }

    function updateOracle(address newOracle) external onlyOwner {
        _oracle = newOracle;
        emit NewOracle(newOracle);
    }

    function updateWhitelist(address newWhitelist) external onlyOwner {
        _whitelist = newWhitelist;
        emit NewWhitelist(newWhitelist);
    }

    function salt(address manager, string memory name, string memory symbol) public pure override returns (bytes32) {
      return keccak256(abi.encodePacked(manager, name, symbol));
    }

    /**
     * @dev Returns the current implementation of `proxy`.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function getProxyImplementation(TransparentUpgradeableProxy proxy)
        public
        view
        returns (address)
    {
        // We need to manually run the static call since the getter cannot be flagged as view
        // bytes4(keccak256("implementation()")) == 0x5c60da1b
        (bool success, bytes memory returndata) = address(proxy).staticcall(hex"5c60da1b");
        require(success);
        return abi.decode(returndata, (address));
    }

    /**
     * @dev Returns the current admin of `proxy`.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function getProxyAdmin(TransparentUpgradeableProxy proxy) public view returns (address) {
        // We need to manually run the static call since the getter cannot be flagged as view
        // bytes4(keccak256("admin()")) == 0xf851a440
        (bool success, bytes memory returndata) = address(proxy).staticcall(hex"f851a440");
        require(success);
        return abi.decode(returndata, (address));
    }

    /**
     * @dev Changes the admin of `proxy` to `newAdmin`.
     *
     * Requirements:
     *
     * - This contract must be the current admin of `proxy`.
     */
    function changeProxyAdmin(TransparentUpgradeableProxy proxy, address newAdmin)
        public
        onlyManager(address(proxy))
    {
        proxy.changeAdmin(newAdmin);
    }

    /**
     * @dev Upgrades `proxy` to `implementation`. See {TransparentUpgradeableProxy-upgradeTo}.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function upgrade(TransparentUpgradeableProxy proxy) public onlyManager(address(proxy)) {
        proxy.upgradeTo(_implementation);
    }

    /**
     * @dev Upgrades `proxy` to `implementation` and calls a function on the new implementation. See
     * {TransparentUpgradeableProxy-upgradeToAndCall}.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function upgradeAndCall(TransparentUpgradeableProxy proxy, bytes memory data)
        public
        payable
        onlyManager(address(proxy))
    {
        proxy.upgradeToAndCall{value: msg.value}(_implementation, data);
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

    function owner() external view returns (address) {
        return _owner;
    }

    function controller() external view override returns (address) {
        return _controller;
    }

    function whitelist() external view override returns (address) {
        return _whitelist;
    }

    function oracle() external view override returns (address) {
        return _oracle;
    }

    function implementation() external view override returns (address) {
        return _implementation;
    }

    function version() external view override returns (uint256) {
        return _version;
    }

    /**
        @notice Creates a Strategy proxy and makes a delegate call to initialize items + percentages on the proxy
    */
    function _createProxy(
        address manager, string memory name, string memory symbol, address[] memory tokens, uint256[] memory percentages
    ) internal returns (address) {
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy{salt: salt(manager, name, symbol)}(
                    _implementation,
                    address(this),
                    abi.encodeWithSelector(
                        bytes4(keccak256("initialize(string,string,uint256,address,address,address[],uint256[])")),
                        name,
                        symbol,
                        _version,
                        _controller,
                        manager,
                        tokens,
                        percentages
                    )
                  );
      return address(proxy);
    }

    function _setupStrategy(
        address manager,
        address strategy,
        bool social,
        uint256 fee,
        uint256 threshold,
        uint256 slippage,
        uint256 timelock,
        address router,
        bytes memory data
    ) internal {
        IStrategyController strategyController = IStrategyController(_controller);
        strategyController.setupStrategy{value: msg.value}(
            manager,
            strategy,
            social,
            fee,
            threshold,
            slippage,
            timelock,
            router,
            data
        );
    }
}


// File contracts/StrategyProxyFactoryAdmin.sol

pragma solidity 0.6.12;


/**
 * @notice Deploys Controller Proxy
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract StrategyProxyFactoryAdmin is ProxyAdmin {
    address public factory;

    constructor(
        address strategyImplementation_,
        address controller_,
        address oracle_,
        address whitelist_
    ) public {
        StrategyProxyFactory factoryImplementation = new StrategyProxyFactory();
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy(
                address(factoryImplementation),
                address(this),
                abi.encodeWithSelector(
                    bytes4(keccak256("initialize(address,address,address,address,address)")),
                    msg.sender,
                    strategyImplementation_,
                    controller_,
                    oracle_,
                    whitelist_
                )
            );
        factory = address(proxy);
    }
}


// File @openzeppelin/contracts/token/ERC20/SafeERC20.sol@v3.3.0


pragma solidity >=0.6.0 <0.8.0;



/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported, non-reverting calls are assumed to be
 * successful.
 * To use this library you can add a `using SafeERC20 for IERC20;` statement to your contract,
 * which allows you to call the safe operations as `token.safeTransfer(...)`, etc.
 */
library SafeERC20 {
    using SafeMath for uint256;
    using Address for address;

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    /**
     * @dev Deprecated. This function has issues similar to the ones found in
     * {IERC20-approve}, and its usage is discouraged.
     *
     * Whenever possible, use {safeIncreaseAllowance} and
     * {safeDecreaseAllowance} instead.
     */
    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        // safeApprove should only be called when setting an initial allowance,
        // or when resetting it to zero. To increase and decrease it, use
        // 'safeIncreaseAllowance' and 'safeDecreaseAllowance'
        // solhint-disable-next-line max-line-length
        require((value == 0) || (token.allowance(address(this), spender) == 0),
            "SafeERC20: approve from non-zero to non-zero allowance"
        );
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, value));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender).add(value);
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender).sub(value, "SafeERC20: decreased allowance below zero");
        _callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     */
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves. We use {Address.functionCall} to perform this call, which verifies that
        // the target address contains contract code and also asserts for success in the low-level call.

        bytes memory returndata = address(token).functionCall(data, "SafeERC20: low-level call failed");
        if (returndata.length > 0) { // Return data is optional
            // solhint-disable-next-line max-line-length
            require(abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
        }
    }
}


// File contracts/StrategyTokenStorage.sol

pragma solidity 0.6.12;

contract StrategyTokenStorage {
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public PERMIT_TYPEHASH;

    mapping(address => uint256) internal _balances;
    mapping(address => uint256) internal _nonces;
    mapping(address => mapping(address => uint256)) internal _allowances;
    uint256 internal _totalSupply;
    string internal _name;
    string internal _symbol;
    uint256 internal _version;
    uint8 internal _decimals;

    address internal _controller;
    address internal _factory;
    address internal _manager;
    address[] internal _strategyItems;
    mapping(address => uint256) internal _percentages;

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}


// File contracts/StrategyToken.sol

pragma solidity 0.6.12;



contract StrategyToken is IStrategyToken, StrategyTokenStorage {
    using SafeMath for uint256;

    string public constant BALANCE_LOW = "ERC20: Amount exceeds balance";

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) external virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * Requirements:
     *
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for ``sender``'s tokens of at least
     * `amount`.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            msg.sender,
            _allowances[sender][msg.sender].sub(amount, "ERC20: allowance too low")
        );
        return true;
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override {
        require(block.timestamp <= deadline, "Expired deadline");

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            spender,
                            value,
                            _nonces[owner],
                            deadline
                        )
                    )
                )
            );

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0) && signer == owner, "Invalid signature");

        _nonces[owner]++;
        _approve(owner, spender, value);
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() external view override returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the nonce of the token holder.
     */
    function nonces(address owner) external view override returns (uint256) {
        return _nonces[owner];
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the value {ERC20} uses, unless {_setupDecimals} is
     * called.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender)
        external
        view
        virtual
        override
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function chainId() public pure returns (uint256 id) {
        assembly {
            id := chainid()
        }
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        _validAddress(sender);
        _validAddress(recipient);
        _balances[sender] = _balances[sender].sub(amount, BALANCE_LOW);
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        _validAddress(account);
        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burn(address account, uint256 amount) internal virtual {
        _validAddress(account);
        _balances[account] = _balances[account].sub(amount, BALANCE_LOW);
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
     *
     * This internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        _validAddress(owner);
        _validAddress(spender);

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _validAddress(address addr) internal pure {
        require(addr != address(0), "ERC20: No address(0)");
    }
}


// File contracts/interfaces/IWhitelist.sol

pragma solidity 0.6.12;

interface IWhitelist {
    function approve(address account) external;

    function revoke(address account) external;

    function approved(address account) external view returns (bool);
}


// File contracts/Strategy.sol

pragma solidity 0.6.12;








/**
 * @notice This contract holds erc20 tokens, and represents individual account holdings with an erc20 strategy token
 * @dev Strategy token holders can withdraw their assets here or in StrategyController
 */
contract Strategy is IStrategy, StrategyToken, ERC1271, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant DIVISOR = 1000;

    // Initialize constructor to disable implementation
    constructor() public initializer {} //solhint-disable-line

    /**
     * @dev Throws if called by any account other than the controller.
     */
    modifier onlyController() {
        require(_controller == msg.sender, "Controller only");
        _;
    }

    /**
     * @notice Initializes new Strategy
     * @dev Should be called from the StrategyProxyFactory  (see StrategyProxyFactory._createProxy())
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 version_,
        address controller_,
        address manager_,
        address[] memory strategyItems_,
        uint256[] memory percentages_
    ) external initializer returns (bool) {
        _controller = controller_;
        _manager = manager_;
        _factory = msg.sender;
        _name = name_;
        _symbol = symbol_;
        _decimals = 18;
        PERMIT_TYPEHASH = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,uint256 version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(name_)),
                version_,
                chainId(),
                address(this)
            )
        );
        // Set structure
        if (strategyItems_.length > 0) {
            verifyStructure(strategyItems_, percentages_);
            _setStructure(strategyItems_, percentages_);
        }
        return true;
    }

    function approveToken(
        IERC20 token,
        address account,
        uint256 amount
    ) external override onlyController {
        token.safeApprove(account, amount);
    }

    function approveTokens(address account, uint256 amount) external override onlyController {
        for (uint256 i = 0; i < _strategyItems.length; i++) {
            IERC20(_strategyItems[i]).safeApprove(account, amount);
        }
    }

    function transferToken(
        IERC20 token,
        address account,
        uint256 amount
    ) external override onlyController {
        token.safeTransfer(account, amount);
    }

    /**
     * @notice Set the structure of the strategy
     * @param newItems An array of token addresses that will comprise the strategy
     * @param newPercentages An array of percentages for each token in the above array. Must total 100%
     */
    function setStructure(address[] memory newItems, uint256[] memory newPercentages)
        external
        override
        onlyController
    {
        _setStructure(newItems, newPercentages);
    }

    /**
     * @notice Withdraw the underlying assets and burn the equivalent amount of strategy token
     * @param amount The amount of strategy tokens to burn to recover the equivalent underlying assets
     */
    function withdraw(uint256 amount) external override {
        require(amount > 0, "0 amount");
        uint256 percentage = amount.mul(10**18).div(_totalSupply);
        _burn(msg.sender, amount);
        for (uint256 i = 0; i < _strategyItems.length; i++) {
            // Should not be possible to have address(0) since the Strategy will check for it
            IERC20 token = IERC20(_strategyItems[i]);
            uint256 currentBalance = token.balanceOf(address(this));
            uint256 tokenAmount = currentBalance.mul(percentage).div(10**18);
            token.safeTransfer(msg.sender, tokenAmount);
        }
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function mint(address account, uint256 amount) external override onlyController {
        _mint(account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function burn(address account, uint256 amount) external override onlyController {
        _burn(account, amount);
    }

    /**
        @notice Update the manager of this Strategy
     */
    function updateManager(address newManager) external override {
        require(msg.sender == _manager, "Not manager");
        _manager = newManager;
    }

    function items() external view override returns (address[] memory) {
        return _strategyItems;
    }

    function percentage(address strategyItem) external view override returns (uint256) {
        return _percentages[strategyItem];
    }

    function isWhitelisted(address account) external view override returns (bool) {
        return IWhitelist(whitelist()).approved(account);
    }

    function controller() external view override returns (address) {
        return _controller;
    }

    function manager() external view override returns (address) {
        return _manager;
    }

    function oracle() external view override returns (address) {
        return IStrategyProxyFactory(_factory).oracle();
    }

    function whitelist() public view override returns (address) {
        return IStrategyProxyFactory(_factory).whitelist();
    }

    /**
     * @notice This function verifies that the structure passed in parameters is valid
     * @dev We check that the array lengths match, that the percentages add 100%,
     *      no zero addresses, and no duplicates
     * @dev Token addresses must be passed in, according to increasing byte value
     */
    function verifyStructure(address[] memory newItems, uint256[] memory newPercentages)
        public
        pure
        override
        returns (bool)
    {
        require(newItems.length > 0, "Cannot set empty structure");
        require(newItems.length == newPercentages.length, "Invalid input lengths");
        require(newItems[0] != address(0), "Invalid item addr"); //Everything else will caught be the ordering requirement below
        uint256 total = 0;
        for (uint256 i = 0; i < newItems.length; i++) {
            require(i == 0 || newItems[i] > newItems[i - 1], "Item ordering");
            require(newPercentages[i] > 0, "0 percentage provided");
            total = total.add(newPercentages[i]);
        }
        require(total == DIVISOR, "Total percentage wrong");
        return true;
    }

    /**
     * @notice Set the structure of the strategy
     * @param newItems An array of token addresses that will comprise the strategy
     * @param newPercentages An array of percentages for each token in the above array. Must total 100%
     */
    function _setStructure(
        address[] memory newItems, uint256[] memory newPercentages
    ) internal {
        // Remove old percentages
        for (uint256 i = 0; i < _strategyItems.length; i++) {
            delete _percentages[_strategyItems[i]];
        }
        for (uint256 i = 0; i < newItems.length; i++) {
            _percentages[newItems[i]] = newPercentages[i];
        }
        _strategyItems = newItems;
    }

    /**
     * @notice Confirm signer is permitted to sign on behalf of contract
     * @param signer The address of the message signer
     * @return Bool confirming whether signer is permitted
     */
    function _checkSigner(address signer) internal view override returns (bool) {
        return signer == _manager;
    }
}
