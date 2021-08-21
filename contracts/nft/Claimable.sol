pragma solidity ^0.8.0;

import "../ecosystem/openzeppelin/token/ERC1155/utils/ERC1155Holder.sol";
import "../ecosystem/openzeppelin/access/Ownable.sol";
import "../interfaces/ILiquidityMigration.sol";
import "../interfaces/IRoot1155.sol";
import "../interfaces/IAdapter.sol";


contract Claimable is Ownable, ERC1155Holder {
    enum State {
        Pending,
        Active,
        Closed
    }
    State private _state;

    uint256 public max;
    address public migration;
    address public collection;

    mapping (address => uint256) public index;
    mapping (address => mapping (uint256 => bool)) public claimed;

    event Claimed(address indexed account, uint256 protocol);
    event StateChange(uint8 changed);
    event Migration(address migration);
    event Collection(address collection);

    /**
    * @dev Require particular state
    */
    modifier onlyState(State state_) {
        require(state() == state_, "Claimable#onlyState: ONLY_STATE_ALLOWED");
        _;
    }

    /* assumption is enum ID will be the same as collection ID,
     * and no further collections will be added whilst active
    */
    constructor(address _migration, address _collection, uint256 _max, address[] memory _index){
        require(_max == _index.length, "Claimable#claim: incorrect max");
        collection = _collection;
        migration = _migration;
        max = _max;
        for (uint256 i = 0; i < _index.length; i++) {
            if (i > 0) {
                require(_index[i] != _index[0] && index[_index[i]] == 0,  "Claimable#constructor: duplicate adapter");
            }
            index[_index[i]] = i;
        }
    }

    /**
     * @notice claim NFT for staking LP
     * @param _lp address of lp
     * @param _adapter address of adapter
     */
    function claim(address _lp, address _adapter)
        public
        onlyState(State.Active)
    {
        require(_lp != address(0), "Claimable#claim: empty address");
        require(_adapter != address(0), "Claimable#claim: empty address");

        require(ILiquidityMigration(migration).adapters(_adapter), "Claimable#claim: not adapter");
        require(IAdapter(_adapter).isWhitelisted(_lp), "Claimable#claim: not associated");
        require(ILiquidityMigration(migration).hasStaked(msg.sender, _lp), "Claimable#claim: not staked");

        uint256 _index = index[_adapter];
        require(!claimed[msg.sender][_index], "Claimable#claim: already claimed");

        require(IERC1155(collection).balanceOf(address(this), _index) > 0, "Claimable#claim: no NFTs left");

        claimed[msg.sender][_index] = true;
        IERC1155(collection).safeTransferFrom(address(this), msg.sender, _index, 1, "");
    }

    /**
     * @notice you wanna be a masta good old boi?
     */
    function master()
        public
        onlyState(State.Active)
    {
        require(!claimed[msg.sender][max], "Claimable#master: claimed");
        for (uint256 i = 0; i < max; i++) {
            require(claimed[msg.sender][i], "Claimable#master: not all");
            require(IERC1155(collection).balanceOf(msg.sender, i) > 0, "Claimable#master: not holding");
        }
        claimed[msg.sender][max] = true;
        IERC1155(collection).safeTransferFrom(address(this), msg.sender, max, 1, "");
    }

    /**
     * @notice claim all through range
     * @param _lp[] array of lp addresses
     * @param _adapter[] array of adapter addresses
     */

    function claimAll(address[] memory _lp, address[] memory _adapter)
        public
    {
        require(_lp.length <= max, "Claimable#claimAll: incorrect length");
        require(_lp.length == _adapter.length, "Claimable#claimAll: incorrect len");
        for (uint256 i = 0; i < _lp.length; i++) {
            claim(_lp[i], _adapter[i]);
        }
    }

    /**
     * @notice we wipe it, and burn all - should have got in already
     */
    function wipe(uint256 _start, uint256 _end)
        public
        onlyOwner
    {
        require(_start < _end, "Claimable#Wipe: range out");
        require(_end <= max, "Claimable#Wipe: out of bounds");
        for (uint256 start = _start; start <= _end; start++) {
            IRoot1155(collection).
            burn(
                address(this),
                start,
                IERC1155(collection).balanceOf(address(this), start)
            );
        }
    }

    /**
     * @notice emergency from deployer change state
     * @param state_ to change to
     */
    function stateChange(State state_)
        public
        onlyOwner
    {
        _stateChange(state_);
    }

    /**
     * @notice emergency from deployer change migration
     * @param _migration to change to
     */
    function updateMigration(address _migration)
        public
        onlyOwner
    {
        require(_migration != migration, "Claimable#UpdateMigration: exists");
        migration = _migration;
        emit Migration(migration);
    }

    /**
     * @notice emergency from deployer change migration
     * @param _collection to change to
     */
    function updateCollection(address _collection)
        public
        onlyOwner
    {
        require(_collection != collection, "Claimable#UpdateCollection: exists");
        collection = _collection;
        emit Collection(collection);
    }

    /**
     * @return current state.
     */
    function state() public view virtual returns (State) {
        return _state;
    }

    function _stateChange(State state_)
        private
    {
        require(_state != state_, "Claimable#changeState: current");
        _state = state_;
        emit StateChange(uint8(_state));
    }
}
