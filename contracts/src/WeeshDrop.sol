// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title WeeshDrop
/// @notice Sends a token the caller already holds to a list of people.
///         Known addresses are paid in the same transaction. Slots without an
///         address stay here until someone presents that slot's secret.
///         A repeating plan pulls from the sender's allowance when anyone pokes it.
///         This contract never mints a stock and never holds a key.
interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

contract WeeshDrop {
    struct Slot {
        address to;
        uint256 amount;
        bytes32 secretHash;
        bool paid;
    }

    struct Drop {
        address sender;
        address token;
        uint64 reclaimAfter;
        string name;
        Slot[] slots;
    }

    struct Plan {
        address sender;
        address token;
        uint64 interval;
        uint64 nextAt;
        uint64 until;
        uint256 amountEach;
        address[] recipients;
        bool active;
    }

    uint256 public constant MAX_SLOTS = 40;
    uint256 public constant MIN_INTERVAL = 1 days;

    uint256 public nextDropId = 1;
    uint256 public nextPlanId = 1;
    mapping(uint256 => Drop) private _drops;
    mapping(uint256 => Plan) private _plans;
    uint256 private _locked;

    error TooMany();
    error BadSlot();
    error BadSecret();
    error NotClaim();
    error AlreadyPaid();
    error NotSender();
    error TooEarly();
    error Nothing();
    error Inactive();
    error ShortPayment();
    error Reentered();

    event DropCreated(uint256 indexed id, address indexed sender, address indexed token, uint256 slots);
    event SlotPaid(uint256 indexed id, uint256 indexed index, address to, uint256 amount);
    event Reclaimed(uint256 indexed id, address indexed sender, uint256 amount);
    event PlanStarted(uint256 indexed id, address indexed sender, address indexed token, uint64 nextAt, uint64 until);
    event PlanPaid(uint256 indexed id, uint64 nextAt);
    event PlanCancelled(uint256 indexed id);

    modifier lock() {
        if (_locked == 1) revert Reentered();
        _locked = 1;
        _;
        _locked = 0;
    }

    function create(
        address token,
        string calldata name,
        uint64 reclaimAfter,
        address[] calldata tos,
        uint256[] calldata amounts,
        bytes32[] calldata secretHashes
    ) external lock returns (uint256 id) {
        uint256 n = tos.length;
        if (n == 0 || n > MAX_SLOTS || bytes(name).length == 0 || bytes(name).length > 64) revert TooMany();
        if (amounts.length != n || secretHashes.length != n || token == address(0)) revert BadSlot();

        id = nextDropId++;
        Drop storage d = _drops[id];
        d.sender = msg.sender;
        d.token = token;
        d.reclaimAfter = reclaimAfter;
        d.name = name;

        uint256 total;
        for (uint256 i; i < n; ++i) {
            if (amounts[i] == 0) revert BadSlot();
            bool openClaim = tos[i] == address(0);
            if (openClaim != (secretHashes[i] != bytes32(0))) revert BadSlot();
            total += amounts[i];
            d.slots.push(Slot({ to: tos[i], amount: amounts[i], secretHash: secretHashes[i], paid: false }));
        }

        _pull(token, msg.sender, total);

        for (uint256 i; i < n; ++i) {
            if (tos[i] == address(0)) continue;
            d.slots[i].paid = true;
            _push(token, tos[i], amounts[i]);
            emit SlotPaid(id, i, tos[i], amounts[i]);
        }
        emit DropCreated(id, msg.sender, token, n);
    }

    function claim(uint256 id, uint256 index, bytes32 secret) external lock {
        Drop storage d = _drops[id];
        if (index >= d.slots.length) revert BadSlot();
        Slot storage s = d.slots[index];
        if (s.to != address(0)) revert NotClaim();
        if (s.paid) revert AlreadyPaid();
        if (keccak256(abi.encodePacked(secret)) != s.secretHash) revert BadSecret();
        s.paid = true;
        s.to = msg.sender;
        _push(d.token, msg.sender, s.amount);
        emit SlotPaid(id, index, msg.sender, s.amount);
    }

    function reclaim(uint256 id) external lock {
        Drop storage d = _drops[id];
        if (msg.sender != d.sender) revert NotSender();
        if (d.reclaimAfter == 0 || block.timestamp < d.reclaimAfter) revert TooEarly();
        uint256 total;
        uint256 n = d.slots.length;
        for (uint256 i; i < n; ++i) {
            Slot storage s = d.slots[i];
            if (!s.paid && s.to == address(0)) {
                s.paid = true;
                total += s.amount;
            }
        }
        if (total == 0) revert Nothing();
        _push(d.token, msg.sender, total);
        emit Reclaimed(id, msg.sender, total);
    }

    function startPlan(
        address token,
        uint64 interval,
        uint64 until,
        uint256 amountEach,
        address[] calldata recipients
    ) external lock returns (uint256 id) {
        uint256 n = recipients.length;
        if (n == 0 || n > MAX_SLOTS) revert TooMany();
        if (interval < MIN_INTERVAL || until <= block.timestamp || amountEach == 0 || token == address(0)) revert BadSlot();
        for (uint256 i; i < n; ++i) {
            if (recipients[i] == address(0)) revert BadSlot();
        }
        id = nextPlanId++;
        Plan storage p = _plans[id];
        p.sender = msg.sender;
        p.token = token;
        p.interval = interval;
        p.nextAt = uint64(block.timestamp) + interval;
        p.until = until;
        p.amountEach = amountEach;
        p.active = p.nextAt <= until;
        for (uint256 i; i < n; ++i) p.recipients.push(recipients[i]);
        _pull(token, msg.sender, amountEach * n);
        for (uint256 i; i < n; ++i) _push(token, recipients[i], amountEach);
        emit PlanStarted(id, msg.sender, token, p.nextAt, until);
        emit PlanPaid(id, p.nextAt);
    }

    /// @notice Pay one due round from the sender's allowance. Anyone may call this.
    function poke(uint256 id) external lock {
        Plan storage p = _plans[id];
        if (!p.active) revert Inactive();
        if (block.timestamp < p.nextAt || block.timestamp > p.until) revert TooEarly();
        uint256 n = p.recipients.length;
        _pull(p.token, p.sender, p.amountEach * n);
        for (uint256 i; i < n; ++i) {
            _push(p.token, p.recipients[i], p.amountEach);
        }
        uint64 next = p.nextAt + p.interval;
        p.nextAt = next;
        if (next > p.until) p.active = false;
        emit PlanPaid(id, p.nextAt);
    }

    function cancelPlan(uint256 id) external {
        Plan storage p = _plans[id];
        if (msg.sender != p.sender) revert NotSender();
        p.active = false;
        emit PlanCancelled(id);
    }

    function dropInfo(uint256 id)
        external
        view
        returns (address sender, address token, uint64 reclaimAfter, string memory name, uint256 slots)
    {
        Drop storage d = _drops[id];
        return (d.sender, d.token, d.reclaimAfter, d.name, d.slots.length);
    }

    function slot(uint256 id, uint256 index)
        external
        view
        returns (address to, uint256 amount, bool paid, bool claimable)
    {
        Slot storage s = _drops[id].slots[index];
        return (s.to, s.amount, s.paid, s.to == address(0) && !s.paid);
    }

    function planInfo(uint256 id)
        external
        view
        returns (
            address sender,
            address token,
            uint64 interval,
            uint64 nextAt,
            uint64 until,
            uint256 amountEach,
            uint256 recipients,
            bool active
        )
    {
        Plan storage p = _plans[id];
        return (p.sender, p.token, p.interval, p.nextAt, p.until, p.amountEach, p.recipients.length, p.active);
    }

    function _pull(address token, address from, uint256 amount) internal {
        uint256 beforeBal = IERC20(token).balanceOf(address(this));
        _call(token, abi.encodeCall(IERC20.transferFrom, (from, address(this), amount)));
        if (IERC20(token).balanceOf(address(this)) - beforeBal != amount) revert ShortPayment();
    }

    function _push(address token, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(IERC20.transfer, (to, amount)));
    }

    function _call(address token, bytes memory data) internal {
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok) revert BadSlot();
        if (ret.length > 0 && !abi.decode(ret, (bool))) revert BadSlot();
    }
}
