// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title QoinDEX
 * @dev Core AMM Swap, Liquidity Pools, Staking and Faucet contract for QoinDEX on TeQoin L2
 */
contract QoinDEX {
    // Contract Token Coordinates
    address public immutable QOIN;
    address public immutable USDC;
    address public immutable USDT;
    address public immutable DAI;
    address public immutable NBLAD;
    address public immutable DE4I;

    // Staking position structure
    struct StakingPosition {
        uint256 amountStaked;
        uint256 lastStakedTime;
        uint256 qoinRewardDebt;
    }

    struct LiquidityPool {
        uint256 tokenAReserve;
        uint256 tokenBReserve;
        uint256 totalLPShares;
        mapping(address => uint256) lpShares;
    }

    // Faucet claims cooldown
    mapping(address => uint256) public lastFaucetClaim; // user => timestamp
    uint256 public constant FAUCET_LIMIT = 10000 * 10**18;
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

    address public owner;

    // Staking Reward Rates (QOIN rewards per hour per 1000 tokens staked)
    // For ETH, it is rewards per hour per 1 ETH staked
    uint256 public rewardRateUsdc = 10;
    uint256 public rewardRateUsdt = 10;
    uint256 public rewardRateDai  = 10;
    uint256 public rewardRateEth  = 10000;

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    // user => token => StakingPosition
    // Representing staked asset mapped to its position
    mapping(address => mapping(address => StakingPosition)) public stakingPositions;
    
    // Auto withdrawal thresholds (kept for frontend parity)
    mapping(address => uint256) public autoWithdrawLimitNBLAD;
    mapping(address => uint256) public autoWithdrawLimitDE4I;

    // LP Pools (Token Pair Key -> Pool Structure)
    mapping(bytes32 => LiquidityPool) private pools;

    // Events
    event TokenSwapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event LiquidityAdded(address indexed user, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 shares);
    event LiquidityRemoved(address indexed user, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 shares);
    event Staked(address indexed user, address indexed token, uint256 amount);
    event Unstaked(address indexed user, address indexed token, uint256 amount);
    event RewardClaimed(address indexed user, string rewardType, uint256 amount);
    event FaucetClaimed(address indexed user, address indexed token, uint256 amount);
    event AutoWithdrawTriggered(address indexed user, address indexed token, uint256 amount);

    constructor(
        address _usdc,
        address _usdt,
        address _dai,
        address _nblad,
        address _de4i,
        address _qoin
    ) {
        USDC = _usdc;
        USDT = _usdt;
        DAI = _dai;
        NBLAD = _nblad;
        DE4I = _de4i;
        QOIN = _qoin;
        owner = msg.sender;
    }

    /**
     * @dev Sets new QOIN reward rates for staking pools
     */
    function setRewardRates(
        uint256 _usdc,
        uint256 _usdt,
        uint256 _dai,
        uint256 _eth
    ) external onlyOwner {
        rewardRateUsdc = _usdc;
        rewardRateUsdt = _usdt;
        rewardRateDai = _dai;
        rewardRateEth = _eth;
    }

    /**
     * @dev Transfer ownership to another address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        owner = newOwner;
    }

    /**
     * @dev Faucet claiming routine for testing assets - Claims QOIN only
     */
    function claimFaucet(address token) external {
        require(token == QOIN, "Only QOIN is compatible with faucet claims");
        require(block.timestamp >= lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN, "Faucet claim cooldown active (24h)");

        lastFaucetClaim[msg.sender] = block.timestamp;
        
        // Transfer 10,000 QOIN to the caller
        require(IERC20(token).transfer(msg.sender, FAUCET_LIMIT), "Faucet transfer failed");

        emit FaucetClaimed(msg.sender, token, FAUCET_LIMIT);
    }

    /**
     * @dev Stake USDC, USDT, DAI or ETH to earn QOIN rewards.
     * For ETH staking, send native ETH coins and pass token = address(0).
     */
    function stake(address token, uint256 amount) external payable {
        if (token == address(0)) {
            require(msg.value > 0, "ETH staking amount must be positive");
            
            // Harvest prior accumulated rewards
            harvestRewards(msg.sender, address(0));

            StakingPosition storage pos = stakingPositions[msg.sender][address(0)];
            pos.amountStaked += msg.value;
            pos.lastStakedTime = block.timestamp;

            emit Staked(msg.sender, address(0), msg.value);
        } else {
            require(token == USDC || token == USDT || token == DAI, "Token not supported for staking");
            require(amount > 0, "Staking amount must be positive");

            // Harvest prior accumulated rewards
            harvestRewards(msg.sender, token);

            require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Staking token transfer failed");

            StakingPosition storage pos = stakingPositions[msg.sender][token];
            pos.amountStaked += amount;
            pos.lastStakedTime = block.timestamp;

            emit Staked(msg.sender, token, amount);
        }
    }

    /**
     * @dev Unstake USDC, USDT, DAI or ETH and harvest QOIN rewards.
     */
    function unstake(address token, uint256 amount) external {
        require(amount > 0, "Unstaking amount must be positive");
        
        if (token == address(0)) {
            StakingPosition storage pos = stakingPositions[msg.sender][address(0)];
            require(pos.amountStaked >= amount, "Insufficient staked ETH balance");

            // Harvest current rewards
            harvestRewards(msg.sender, address(0));

            pos.amountStaked -= amount;
            pos.lastStakedTime = block.timestamp;

            payable(msg.sender).transfer(amount);
            emit Unstaked(msg.sender, address(0), amount);
        } else {
            require(token == USDC || token == USDT || token == DAI, "Token not supported for unstaking");
            StakingPosition storage pos = stakingPositions[msg.sender][token];
            require(pos.amountStaked >= amount, "Insufficient staked token balance");

            // Harvest current rewards
            harvestRewards(msg.sender, token);

            pos.amountStaked -= amount;
            pos.lastStakedTime = block.timestamp;

            require(IERC20(token).transfer(msg.sender, amount), "Unstaking withdrawal failed");
            emit Unstaked(msg.sender, token, amount);
        }
    }

    /**
     * @dev Read claimable QOIN rewards accumulated on-chain for a single token.
     */
    function getClaimableRewards(address userAddress, address token) public view returns (uint256 pending) {
        StakingPosition memory pos = stakingPositions[userAddress][token];
        pending = pos.qoinRewardDebt;

        if (pos.amountStaked > 0) {
            uint256 secondsPassed = block.timestamp - pos.lastStakedTime;
            
            // Normalize staked amount to 18 decimals representation
            uint256 normalizedStake = pos.amountStaked;
            if (token == USDC || token == USDT) {
                normalizedStake = pos.amountStaked * 10**12; // 6 to 18 decimals
            }

            uint256 rate = 1;
            if (token == USDC) rate = rewardRateUsdc;
            else if (token == USDT) rate = rewardRateUsdt;
            else if (token == DAI) rate = rewardRateDai;
            else if (token == address(0)) rate = rewardRateEth;

            // rate represents rewards per 1000 staked units per hour
            pending += (normalizedStake * rate * secondsPassed) / (3600 * 1000);
        }
    }

    /**
     * @dev Setup custom auto withdraw limits (kept for ABI compatibility)
     */
    function setAutoWithdrawLimits(uint256 _nbladThreshold, uint256 _de4iThreshold) external {
        autoWithdrawLimitNBLAD[msg.sender] = _nbladThreshold;
        autoWithdrawLimitDE4I[msg.sender] = _de4iThreshold;
    }

    /**
     * @dev Claim and transfer QOIN rewards for a single staked token.
     */
    function harvestRewards(address userAddress, address token) public {
        uint256 claimable = getClaimableRewards(userAddress, token);
        
        StakingPosition storage pos = stakingPositions[userAddress][token];
        pos.lastStakedTime = block.timestamp;
        pos.qoinRewardDebt = 0;

        if (claimable > 0) {
            uint256 contractBal = IERC20(QOIN).balanceOf(address(this));
            uint256 amountToTransfer = claimable > contractBal ? contractBal : claimable;
            
            if (claimable > amountToTransfer) {
                pos.qoinRewardDebt = claimable - amountToTransfer;
            }

            if (amountToTransfer > 0) {
                require(IERC20(QOIN).transfer(userAddress, amountToTransfer), "QOIN reward distribution failed");
                emit RewardClaimed(userAddress, "QOIN", amountToTransfer);
            }
        }
    }

    /**
     * @dev Harvest QOIN rewards from all four yield pools at once.
     */
    function harvestAllRewards() external {
        harvestRewards(msg.sender, USDC);
        harvestRewards(msg.sender, USDT);
        harvestRewards(msg.sender, DAI);
        harvestRewards(msg.sender, address(0));
    }

    /**
     * @dev Constant Product AMM Swap Logic (x * y = k)
     */
    function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256 amountOut) {
        require(amountIn > 0, "Input amount must be positive");

        bytes32 poolKey = getPoolKey(tokenIn, tokenOut);
        LiquidityPool storage pool = pools[poolKey];

        // Special 1:1 Stablecoin Swap for USDC & USDT with zero price impact
        if ((tokenIn == USDC && tokenOut == USDT) || (tokenIn == USDT && tokenOut == USDC)) {
            amountOut = amountIn; // 1:1 exchange rate with zero slippage
            
            require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "Token deposit failed");
            require(IERC20(tokenOut).transfer(msg.sender, amountOut), "Token withdrawal failed");
            
            // Sync the internal reserves if pool has been initialized
            if (tokenIn < tokenOut) {
                pool.tokenAReserve += amountIn;
                if (pool.tokenBReserve >= amountOut) {
                    pool.tokenBReserve -= amountOut;
                }
            } else {
                pool.tokenBReserve += amountIn;
                if (pool.tokenAReserve >= amountOut) {
                    pool.tokenAReserve -= amountOut;
                }
            }
            
            emit TokenSwapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
            return amountOut;
        }

        uint256 reserveIn = (tokenIn < tokenOut) ? pool.tokenAReserve : pool.tokenBReserve;
        uint256 reserveOut = (tokenIn < tokenOut) ? pool.tokenBReserve : pool.tokenAReserve;

        require(reserveIn > 0 && reserveOut > 0, "Pool has insufficient liquidity");

        // Swap Math: dy = (y * dx * 997) / (x * 1000 + dx * 997) - 0.3% trading fee
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;

        require(amountOut < reserveOut, "Price impact is too high; insufficient depth");

        // Perform actual ERC20 transactions
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "Token deposit failed");
        require(IERC20(tokenOut).transfer(msg.sender, amountOut), "Token withdrawal failed");

        // Update pools internal reserves
        if (tokenIn < tokenOut) {
            pool.tokenAReserve += amountIn;
            pool.tokenBReserve -= amountOut;
        } else {
            pool.tokenBReserve += amountIn;
            pool.tokenAReserve -= amountOut;
        }

        emit TokenSwapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    /**
     * @dev Add Liquidity mechanics
     */
    function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external returns (uint256 shares) {
        bytes32 poolKey = getPoolKey(tokenA, tokenB);
        LiquidityPool storage pool = pools[poolKey];

        require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountA), "Token A deposit failed");
        require(IERC20(tokenB).transferFrom(msg.sender, address(this), amountB), "Token B deposit failed");

        if (pool.totalLPShares == 0) {
            // Geometric mean for initial shares
            shares = sqrt(amountA * amountB);
        } else {
            uint256 shareA = (amountA * pool.totalLPShares) / pool.tokenAReserve;
            uint256 shareB = (amountB * pool.totalLPShares) / pool.tokenBReserve;
            shares = shareA < shareB ? shareA : shareB;
        }

        require(shares > 0, "No LP tokens minted");

        pool.tokenAReserve += amountA;
        pool.tokenBReserve += amountB;
        pool.totalLPShares += shares;
        pool.lpShares[msg.sender] += shares;

        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB, shares);
    }

    /**
     * @dev Remove Liquidity mechanics
     */
    function removeLiquidity(address tokenA, address tokenB, uint256 shares) external returns (uint256 amountA, uint256 amountB) {
        bytes32 poolKey = getPoolKey(tokenA, tokenB);
        LiquidityPool storage pool = pools[poolKey];

        uint256 userShares = pool.lpShares[msg.sender];
        require(userShares >= shares, "Insufficient LP shares to burn");

        amountA = (shares * pool.tokenAReserve) / pool.totalLPShares;
        amountB = (shares * pool.tokenBReserve) / pool.totalLPShares;

        pool.lpShares[msg.sender] -= shares;
        pool.totalLPShares -= shares;
        pool.tokenAReserve -= amountA;
        pool.tokenBReserve -= amountB;

        require(IERC20(tokenA).transfer(msg.sender, amountA), "Token A return failed");
        require(IERC20(tokenB).transfer(msg.sender, amountB), "Token B return failed");

        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB, shares);
    }

    // Helper functions
    function getPoolKey(address tokenA, address tokenB) public pure returns (bytes32) {
        return tokenA < tokenB ? keccak256(abi.encodePacked(tokenA, tokenB)) : keccak256(abi.encodePacked(tokenB, tokenA));
    }

    function getPoolReserves(address tokenA, address tokenB) external view returns (uint256 reserveA, uint256 reserveB, uint256 totalShares) {
        bytes32 poolKey = getPoolKey(tokenA, tokenB);
        LiquidityPool storage pool = pools[poolKey];
        return (pool.tokenAReserve, pool.tokenBReserve, pool.totalLPShares);
    }

    function getUserLPShares(address tokenA, address tokenB, address user) external view returns (uint256) {
        bytes32 poolKey = getPoolKey(tokenA, tokenB);
        return pools[poolKey].lpShares[user];
    }

    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
