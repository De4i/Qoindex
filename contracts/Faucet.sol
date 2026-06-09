// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Faucet {
    address public owner;
    mapping(address => uint256) public lastFaucetClaim;
    uint256 public constant FAUCET_LIMIT = 0.001 ether;
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

    event FaucetClaimed(address indexed user, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    function claimFaucet() external {
        require(block.timestamp >= lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN, "Faucet claim cooldown active (24h)");
        require(address(this).balance >= FAUCET_LIMIT, "Faucet is depleted");

        lastFaucetClaim[msg.sender] = block.timestamp;
        payable(msg.sender).transfer(FAUCET_LIMIT);

        emit FaucetClaimed(msg.sender, FAUCET_LIMIT);
    }

    function claimFaucet(address receiver) external {
        uint256 startGas = gasleft();
        require(block.timestamp >= lastFaucetClaim[receiver] + FAUCET_COOLDOWN, "Faucet claim cooldown active (24h)");
        require(address(this).balance >= FAUCET_LIMIT, "Faucet is depleted");

        lastFaucetClaim[receiver] = block.timestamp;
        payable(receiver).transfer(FAUCET_LIMIT);

        emit FaucetClaimed(receiver, FAUCET_LIMIT);

        // Refund gas cost to the Msg.sender (the sponsor/owner relayer) from the faucet contract's own balance
        // This keeps the relayer wallet completely untouched and self-funded by the Faucet contract!
        uint256 gasUsed = startGas - gasleft() + 35000; // Account for operations with a standard Execution buffer
        uint256 refundAmount = gasUsed * tx.gasprice;
        if (address(this).balance >= refundAmount) {
            payable(msg.sender).transfer(refundAmount);
        }
    }

    /**
     * @dev Allows the owner to refund/reclaim the contract's ETH balance back to the deployer wallet.
     */
    function withdraw(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance in Faucet contract");
        payable(owner).transfer(amount);
        emit FundsWithdrawn(owner, amount);
    }
}

