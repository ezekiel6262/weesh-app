// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title WeeshPortfolioRegistry
/// @notice Public strategy definitions and discussion. It never holds assets or executes trades.
contract WeeshPortfolioRegistry {
    struct Portfolio {
        address creator;
        uint64 createdAt;
        uint8 visibility; // 0 public, 1 unlisted
        bool showHoldings;
        string name;
        string thesis;
        address[] assets;
        uint16[] weights;
    }

    struct Comment {
        address author;
        uint64 createdAt;
        string body;
    }

    uint256 public nextPortfolioId = 1;
    mapping(uint256 => Portfolio) private _portfolios;
    mapping(uint256 => Comment[]) private _comments;
    mapping(uint256 => mapping(address => bool)) public following;
    mapping(uint256 => uint256) public followerCount;

    error BadPortfolio();
    error NotFound();
    error AlreadyFollowing();
    error NotFollowing();

    event PortfolioCreated(uint256 indexed id, address indexed creator, uint8 visibility);
    event Followed(uint256 indexed id, address indexed follower);
    event Unfollowed(uint256 indexed id, address indexed follower);
    event Commented(uint256 indexed id, address indexed author, uint256 indexed commentId);

    function create(
        string calldata name,
        string calldata thesis,
        address[] calldata assets,
        uint16[] calldata weights,
        uint8 visibility,
        bool showHoldings
    ) external returns (uint256 id) {
        uint256 n = assets.length;
        if (
            bytes(name).length == 0 || bytes(name).length > 64 ||
            bytes(thesis).length > 600 || n == 0 || n > 12 ||
            weights.length != n || visibility > 1
        ) revert BadPortfolio();
        uint256 total;
        for (uint256 i; i < n; ++i) {
            if (assets[i] == address(0) || weights[i] == 0) revert BadPortfolio();
            total += weights[i];
            for (uint256 j; j < i; ++j) if (assets[j] == assets[i]) revert BadPortfolio();
        }
        if (total != 10_000) revert BadPortfolio();

        id = nextPortfolioId++;
        Portfolio storage p = _portfolios[id];
        p.creator = msg.sender;
        p.createdAt = uint64(block.timestamp);
        p.visibility = visibility;
        p.showHoldings = showHoldings;
        p.name = name;
        p.thesis = thesis;
        for (uint256 i; i < n; ++i) {
            p.assets.push(assets[i]);
            p.weights.push(weights[i]);
        }
        emit PortfolioCreated(id, msg.sender, visibility);
    }

    function follow(uint256 id) external {
        _requirePortfolio(id);
        if (following[id][msg.sender]) revert AlreadyFollowing();
        following[id][msg.sender] = true;
        followerCount[id]++;
        emit Followed(id, msg.sender);
    }

    function unfollow(uint256 id) external {
        _requirePortfolio(id);
        if (!following[id][msg.sender]) revert NotFollowing();
        following[id][msg.sender] = false;
        followerCount[id]--;
        emit Unfollowed(id, msg.sender);
    }

    function comment(uint256 id, string calldata body) external {
        _requirePortfolio(id);
        uint256 n = bytes(body).length;
        if (n == 0 || n > 280) revert BadPortfolio();
        _comments[id].push(Comment({author: msg.sender, createdAt: uint64(block.timestamp), body: body}));
        emit Commented(id, msg.sender, _comments[id].length - 1);
    }

    function portfolio(uint256 id) external view returns (Portfolio memory) {
        _requirePortfolio(id);
        return _portfolios[id];
    }

    function commentCount(uint256 id) external view returns (uint256) {
        _requirePortfolio(id);
        return _comments[id].length;
    }

    function commentAt(uint256 id, uint256 index) external view returns (Comment memory) {
        _requirePortfolio(id);
        return _comments[id][index];
    }

    function _requirePortfolio(uint256 id) private view {
        if (id == 0 || id >= nextPortfolioId) revert NotFound();
    }
}
