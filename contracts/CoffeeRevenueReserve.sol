// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "./system-contracts/hedera-token-service/IHederaTokenService.sol";
import "./system-contracts/HederaResponseCodes.sol";
import "./system-contracts/hedera-token-service/IHRC719.sol";
import "./interfaces/IERC20.sol";

contract CoffeeRevenueReserve {
    
    // Revenue distribution structure
    struct RevenueDistribution {
        uint256 distributionDate;
        uint64 totalRevenue;
        uint64 totalTokenHolders;
        bool completed;
        mapping(address => uint64) holderShares;
        mapping(address => bool) claimed;
    }

    // Token holder information
    struct TokenHolder {
        address holder;
        uint64 tokenBalance;
        uint64 sharePercentage; // Percentage * 100 for precision (e.g., 1.5% = 150)
    }

    // Constants and state variables
    address public USDC;
    IHederaTokenService constant hts = IHederaTokenService(address(0x167));
    
    address public groveToken;
    address public farmer;
    address public issuer;
    uint256 public totalReserve;
    uint256 public totalDistributed;
    uint256 public farmerWithdrawn;
    
    // Distribution tracking
    uint256 public distributionCounter;
    mapping(uint256 => RevenueDistribution) public distributions;
    mapping(address => uint256) public holderTotalEarnings;
    
    // Events
    event RevenueDeposited(
        uint64 amount,
        uint256 newTotalReserve,
        uint256 timestamp
    );
    
    event RevenueDistributed(
        uint256 indexed distributionId,
        uint64 totalRevenue,
        uint64 totalHolders,
        uint256 timestamp
    );
    
    event HolderPaid(
        uint256 indexed distributionId,
        address indexed holder,
        uint64 amount,
        uint256 timestamp
    );
    
    event FarmerShareWithdrawn(
        address indexed farmer,
        uint64 amount,
        uint256 timestamp
    );

    event TransferFailed(
        uint256 indexed distributionId,
        address indexed holder,
        uint64 amount,
        uint256 timestamp
    );

    event BatchDistributionCompleted(
        uint256 indexed distributionId,
        uint64 successfulTransfers,
        uint64 totalDistributed,
        uint256 timestamp
    );

    event DistributionError(
        uint256 indexed distributionId,
        string reason,
        uint256 timestamp
    );

    // Custom errors
    error UnauthorizedAccess(address caller);
    error InsufficientReserve(uint64 requested, uint256 available);
    error DistributionNotFound(uint256 distributionId);
    error DistributionAlreadyCompleted(uint256 distributionId);
    error NoTokensHeld(address holder);
    error AlreadyClaimed(address holder, uint256 distributionId);

    modifier onlyAuthorized() {
        require(
            msg.sender == issuer || 
            msg.sender == farmer || 
            msg.sender == address(this), 
            "Not authorized"
        );
        _;
    }

    modifier onlyIssuer() {
        require(msg.sender == issuer, "Only issuer can call this function");
        _;
    }

    modifier onlyFarmer() {
        require(msg.sender == farmer, "Only farmer can call this function");
        _;
    }

    constructor(address _groveToken, address _farmer, address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC token address");
        
        USDC = _usdcToken;
        
        // Associate with USDC token
        uint256 responseCode = IHRC719(USDC).associate();
        if (int32(uint32(responseCode)) != HederaResponseCodes.SUCCESS) {
            revert("Failed to setup USDC token association");
        }
        
        groveToken = _groveToken;
        farmer = _farmer;
        issuer = msg.sender;
        totalReserve = 0;
        totalDistributed = 0;
        farmerWithdrawn = 0;
        distributionCounter = 0;
    }

    /**
     * @dev Deposit revenue into the reserve
     */
    function deposit(uint64 amount) external onlyAuthorized {
        totalReserve += amount;
        
        emit RevenueDeposited(amount, totalReserve, block.timestamp);
    }

    /**
     * @dev Withdraw from reserve (internal use)
     */
    function withdraw(uint64 amount) internal {
        if (amount > totalReserve) {
            revert InsufficientReserve(amount, totalReserve);
        }
        totalReserve -= amount;
    }

    /**
     * @dev Calculate token holder shares based on their token ownership
     */
    function calculateTokenHolderShares(address token) 
        public 
        view 
        returns (address[] memory holders, uint64[] memory shares) 
    {
        // This is a simplified implementation
        // In a real scenario, you'd need to track all token holders
        // For now, we'll return empty arrays and let the calling contract provide the data
        holders = new address[](0);
        shares = new uint64[](0);
    }

    /**
     * @dev Distribute revenue to token holders with enhanced safeguards
     */
    function distributeRevenue(
        address token,
        uint64 totalRevenue
    ) external onlyIssuer {
        require(token == groveToken, "Invalid token address");
        require(totalRevenue > 0, "Revenue must be positive");
        require(totalRevenue <= totalReserve, "Insufficient reserve for distribution");

        // Get total token supply
        uint256 totalTokenSupply = IERC20(token).totalSupply();
        require(totalTokenSupply > 0, "No tokens in circulation");

        // Prevent duplicate distributions within short time frame
        if (distributionCounter > 0) {
            RevenueDistribution storage lastDistribution = distributions[distributionCounter - 1];
            require(
                block.timestamp - lastDistribution.distributionDate >= 1 hours,
                "Cannot distribute revenue within 1 hour of last distribution"
            );
        }

        // Validate revenue amount is reasonable
        require(totalRevenue >= 1e6, "Revenue too small (minimum 1 USDC)");
        require(totalRevenue <= 1e12, "Revenue too large (maximum 1M USDC)");

        // Create new distribution record with safeguards
        uint256 distributionId = distributionCounter++;
        RevenueDistribution storage distribution = distributions[distributionId];
        distribution.distributionDate = block.timestamp;
        distribution.totalRevenue = totalRevenue;
        distribution.completed = false;

        // Update reserve with double-check
        uint256 reserveBeforeWithdraw = totalReserve;
        withdraw(totalRevenue);
        require(totalReserve == reserveBeforeWithdraw - totalRevenue, "Reserve calculation error");
        
        totalDistributed += totalRevenue;

        emit RevenueDistributed(
            distributionId,
            totalRevenue,
            0, // Will be updated as holders claim
            block.timestamp
        );
    }

    /**
     * @dev Validate distribution integrity before processing
     */
    function validateDistribution(
        uint256 distributionId,
        address[] memory holders,
        uint64[] memory tokenAmounts
    ) external view returns (bool isValid, string memory reason) {
        if (distributionId >= distributionCounter) {
            return (false, "Distribution does not exist");
        }

        RevenueDistribution storage distribution = distributions[distributionId];
        if (distribution.completed) {
            return (false, "Distribution already completed");
        }

        if (holders.length != tokenAmounts.length) {
            return (false, "Arrays length mismatch");
        }

        if (holders.length == 0) {
            return (false, "No holders provided");
        }

        // Check for duplicate holders
        for (uint256 i = 0; i < holders.length; i++) {
            for (uint256 j = i + 1; j < holders.length; j++) {
                if (holders[i] == holders[j]) {
                    return (false, "Duplicate holder addresses");
                }
            }
        }

        // Validate token amounts sum
        uint256 totalTokenSupply = IERC20(groveToken).totalSupply();
        uint64 totalTokensInBatch = 0;
        for (uint256 i = 0; i < tokenAmounts.length; i++) {
            totalTokensInBatch += tokenAmounts[i];
        }

        if (totalTokensInBatch > totalTokenSupply) {
            return (false, "Token amounts exceed total supply");
        }

        return (true, "");
    }

    /**
     * @dev Distribute revenue to specific token holders (batch) with enhanced safeguards
     */
    function distributeRevenueToHolders(
        uint256 distributionId,
        address[] memory holders,
        uint64[] memory tokenAmounts
    ) public onlyIssuer {
        require(holders.length == tokenAmounts.length, "Arrays length mismatch");
        require(holders.length > 0, "No holders provided");
        require(holders.length <= 100, "Too many holders in single batch");
        
        RevenueDistribution storage distribution = distributions[distributionId];
        require(distribution.distributionDate > 0, "Distribution not found");
        require(!distribution.completed, "Distribution already completed");

        uint256 totalTokenSupply = IERC20(groveToken).totalSupply();
        require(totalTokenSupply > 0, "No tokens in circulation");
        
        uint64 totalRevenue = distribution.totalRevenue;
        uint64 totalDistributed = 0;
        uint64 successfulTransfers = 0;

        // Validate total token amounts don't exceed supply
        uint64 totalTokensInBatch = 0;
        for (uint256 i = 0; i < tokenAmounts.length; i++) {
            totalTokensInBatch += tokenAmounts[i];
        }
        require(totalTokensInBatch <= totalTokenSupply, "Token amounts exceed total supply");

        // Process each holder
        for (uint256 i = 0; i < holders.length; i++) {
            address holder = holders[i];
            uint64 tokenBalance = tokenAmounts[i];
            
            // Skip if already claimed or no tokens
            if (tokenBalance == 0 || distribution.claimed[holder]) {
                continue;
            }

            // Validate holder address
            require(holder != address(0), "Invalid holder address");
            require(holder != address(this), "Cannot distribute to self");

            // Calculate proportional share with precision
            uint64 holderShare = _calculateHolderShare(totalRevenue, tokenBalance, totalTokenSupply);
            
            if (holderShare > 0) {
                // Attempt transfer with error handling
                bool transferSuccess = _safeTransferToHolder(holder, holderShare);
                
                if (transferSuccess) {
                    distribution.holderShares[holder] = holderShare;
                    distribution.claimed[holder] = true;
                    holderTotalEarnings[holder] += holderShare;
                    totalDistributed += holderShare;
                    successfulTransfers++;
                    
                    emit HolderPaid(distributionId, holder, holderShare, block.timestamp);
                } else {
                    // Log failed transfer but continue with others
                    emit TransferFailed(distributionId, holder, holderShare, block.timestamp);
                }
            }
        }

        distribution.totalTokenHolders = successfulTransfers;
        distribution.completed = true;

        emit BatchDistributionCompleted(
            distributionId,
            successfulTransfers,
            totalDistributed,
            block.timestamp
        );
    }

    /**
     * @dev Calculate holder's proportional share with precision handling
     */
    function _calculateHolderShare(
        uint64 totalRevenue,
        uint64 tokenBalance,
        uint256 totalTokenSupply
    ) internal pure returns (uint64) {
        if (totalTokenSupply == 0 || tokenBalance == 0) {
            return 0;
        }
        
        // Use higher precision calculation to avoid rounding errors
        uint256 share = (uint256(totalRevenue) * uint256(tokenBalance)) / totalTokenSupply;
        return uint64(share);
    }

    /**
     * @dev Safely transfer USDC to holder with error handling
     */
    function _safeTransferToHolder(address holder, uint64 amount) internal returns (bool) {
        try this.executeTransferToHolder(holder, amount) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Execute transfer to holder (external for try-catch)
     */
    function executeTransferToHolder(address holder, uint64 amount) external {
        require(msg.sender == address(this), "Only self can call");
        
        grantAllowanceToSelf(amount);
        int64 responseCode = hts.transferFrom(USDC, address(this), holder, amount);
        
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Transfer failed");
        }
    }

    /**
     * @dev Distribute revenue in multiple batches to handle large holder lists
     */
    function distributeBatchRevenue(
        uint256 distributionId,
        address[] memory holders,
        uint64[] memory tokenAmounts,
        uint256 batchSize
    ) external onlyIssuer {
        require(batchSize > 0 && batchSize <= 50, "Invalid batch size");
        require(holders.length == tokenAmounts.length, "Arrays length mismatch");
        
        uint256 totalHolders = holders.length;
        uint256 processedHolders = 0;
        
        while (processedHolders < totalHolders) {
            uint256 endIndex = processedHolders + batchSize;
            if (endIndex > totalHolders) {
                endIndex = totalHolders;
            }
            
            // Create batch arrays
            uint256 batchLength = endIndex - processedHolders;
            address[] memory batchHolders = new address[](batchLength);
            uint64[] memory batchAmounts = new uint64[](batchLength);
            
            for (uint256 i = 0; i < batchLength; i++) {
                batchHolders[i] = holders[processedHolders + i];
                batchAmounts[i] = tokenAmounts[processedHolders + i];
            }
            
            // Process batch
            distributeRevenueToHolders(distributionId, batchHolders, batchAmounts);
            
            processedHolders = endIndex;
        }
    }

    /**
     * @dev Allow farmer to withdraw their share
     */
    function withdrawFarmerShare(uint64 amount, address farmerAddress) external onlyIssuer {
        require(farmerAddress == farmer, "Invalid farmer address");
        require(amount > 0, "Amount must be positive");
        require(amount <= totalReserve, "Insufficient reserve");

        // Transfer USDC to farmer
        grantAllowanceToSelf(amount);
        int64 responseCode = hts.transferFrom(USDC, address(this), farmer, amount);
        
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer farmer share");
        }

        withdraw(amount);
        farmerWithdrawn += amount;

        emit FarmerShareWithdrawn(farmer, amount, block.timestamp);
    }

    /**
     * @dev Grant allowance to self for transfers
     */
    function grantAllowanceToSelf(uint256 amount) private {
        int64 responseCode = hts.approve(USDC, address(this), amount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to grant allowance to self");
        }
    }

    /**
     * @dev Refund USDC to a specific account (for token sales)
     */
    function refund(uint256 amount, address account) external onlyIssuer {
        require(amount > 0, "Amount must be positive");
        require(amount <= totalReserve, "Insufficient reserve");

        grantAllowanceToSelf(amount);
        int64 responseCode = hts.transferFrom(USDC, address(this), account, amount);
        
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to refund");
        }

        withdraw(uint64(amount));
    }   
 /**
     * @dev Get distribution information
     */
    function getDistribution(uint256 distributionId) 
        external 
        view 
        returns (
            uint256 distributionDate,
            uint64 totalRevenue,
            uint64 totalTokenHolders,
            bool completed
        ) 
    {
        RevenueDistribution storage distribution = distributions[distributionId];
        return (
            distribution.distributionDate,
            distribution.totalRevenue,
            distribution.totalTokenHolders,
            distribution.completed
        );
    }

    /**
     * @dev Get holder's share from a specific distribution
     */
    function getHolderShare(uint256 distributionId, address holder) 
        external 
        view 
        returns (uint64 share, bool claimed) 
    {
        RevenueDistribution storage distribution = distributions[distributionId];
        return (
            distribution.holderShares[holder],
            distribution.claimed[holder]
        );
    }

    /**
     * @dev Get holder's total earnings across all distributions
     */
    function getHolderTotalEarnings(address holder) external view returns (uint256) {
        return holderTotalEarnings[holder];
    }

    /**
     * @dev Get reserve statistics
     */
    function getReserveStats() 
        external 
        view 
        returns (
            uint256 _totalReserve,
            uint256 _totalDistributed,
            uint256 _farmerWithdrawn,
            uint256 _distributionCount
        ) 
    {
        return (
            totalReserve,
            totalDistributed,
            farmerWithdrawn,
            distributionCounter
        );
    }

    /**
     * @dev Get available balance for distribution
     */
    function getAvailableBalance() external view returns (uint256) {
        return totalReserve;
    }

    /**
     * @dev Check if holder has claimed from a distribution
     */
    function hasClaimed(uint256 distributionId, address holder) external view returns (bool) {
        return distributions[distributionId].claimed[holder];
    }

    /**
     * @dev Get all distribution IDs (for frontend queries)
     */
    function getDistributionHistory() 
        external 
        view 
        returns (uint256[] memory distributionIds) 
    {
        distributionIds = new uint256[](distributionCounter);
        for (uint256 i = 0; i < distributionCounter; i++) {
            distributionIds[i] = i;
        }
        return distributionIds;
    }

    /**
     * @dev Calculate projected earnings for a token holder
     */
    function calculateProjectedEarnings(
        address holder,
        uint64 projectedRevenue
    ) external view returns (uint64) {
        uint256 holderBalance = IERC20(groveToken).balanceOf(holder);
        uint256 totalSupply = IERC20(groveToken).totalSupply();
        
        if (totalSupply == 0 || holderBalance == 0) {
            return 0;
        }
        
        return (projectedRevenue * uint64(holderBalance)) / uint64(totalSupply);
    }

    /**
     * @dev Emergency function to recover stuck tokens (admin only)
     */
    function emergencyWithdraw(address token, uint256 amount) external {
        require(msg.sender == issuer, "Only issuer can emergency withdraw");
        require(token != USDC, "Cannot withdraw USDC reserves");
        
        // This would be used for recovering accidentally sent tokens
        // Implementation would depend on the specific token type
    }

    /**
     * @dev Update farmer address (in case of ownership transfer)
     */
    function updateFarmer(address newFarmer) external onlyIssuer {
        require(newFarmer != address(0), "Invalid farmer address");
        farmer = newFarmer;
    }

    /**
     * @dev Get detailed distribution history for analytics
     */
    function getDistributionDetails(uint256 distributionId)
        external
        view
        returns (
            uint256 distributionDate,
            uint64 totalRevenue,
            uint64 totalTokenHolders,
            bool completed,
            uint64 totalDistributed
        )
    {
        RevenueDistribution storage distribution = distributions[distributionId];
        
        // Calculate total distributed amount
        uint64 distributed = 0;
        // Note: In a real implementation, you'd track this more efficiently
        
        return (
            distribution.distributionDate,
            distribution.totalRevenue,
            distribution.totalTokenHolders,
            distribution.completed,
            distributed
        );
    }

    /**
     * @dev Get holder's distribution history
     */
    function getHolderDistributionHistory(address holder)
        external
        view
        returns (
            uint256[] memory distributionIds,
            uint64[] memory amounts,
            uint256[] memory dates
        )
    {
        // Count holder's distributions
        uint256 count = 0;
        for (uint256 i = 0; i < distributionCounter; i++) {
            if (distributions[i].claimed[holder] && distributions[i].holderShares[holder] > 0) {
                count++;
            }
        }

        // Create result arrays
        distributionIds = new uint256[](count);
        amounts = new uint64[](count);
        dates = new uint256[](count);

        uint256 index = 0;
        for (uint256 i = 0; i < distributionCounter; i++) {
            if (distributions[i].claimed[holder] && distributions[i].holderShares[holder] > 0) {
                distributionIds[index] = i;
                amounts[index] = distributions[i].holderShares[holder];
                dates[index] = distributions[i].distributionDate;
                index++;
            }
        }
    }

    /**
     * @dev Get distribution statistics
     */
    function getDistributionStats()
        external
        view
        returns (
            uint256 totalDistributions,
            uint256 completedDistributions,
            uint64 totalRevenueDistributed,
            uint64 averageDistributionAmount
        )
    {
        totalDistributions = distributionCounter;
        
        uint64 totalRevenue = 0;
        for (uint256 i = 0; i < distributionCounter; i++) {
            if (distributions[i].completed) {
                completedDistributions++;
                totalRevenue += distributions[i].totalRevenue;
            }
        }
        
        totalRevenueDistributed = totalRevenue;
        if (completedDistributions > 0) {
            averageDistributionAmount = totalRevenue / uint64(completedDistributions);
        }
    }

    /**
     * @dev Check if distribution has any failed transfers
     */
    function hasFailedTransfers(uint256 distributionId)
        external
        view
        returns (bool)
    {
        // This would require tracking failed transfers in storage
        // For now, return false as a placeholder
        return false;
    }

    /**
     * @dev Retry failed transfers for a distribution
     */
    function retryFailedTransfers(
        uint256 distributionId,
        address[] memory failedHolders,
        uint64[] memory amounts
    ) external onlyIssuer {
        require(failedHolders.length == amounts.length, "Arrays length mismatch");
        
        RevenueDistribution storage distribution = distributions[distributionId];
        require(distribution.distributionDate > 0, "Distribution not found");
        
        for (uint256 i = 0; i < failedHolders.length; i++) {
            address holder = failedHolders[i];
            uint64 amount = amounts[i];
            
            if (!distribution.claimed[holder] && amount > 0) {
                bool success = _safeTransferToHolder(holder, amount);
                
                if (success) {
                    distribution.holderShares[holder] = amount;
                    distribution.claimed[holder] = true;
                    holderTotalEarnings[holder] += amount;
                    
                    emit HolderPaid(distributionId, holder, amount, block.timestamp);
                }
            }
        }
    }

    /**
     * @dev Get contract information
     */
    function getContractInfo() 
        external 
        view 
        returns (
            address _groveToken,
            address _farmer,
            address _issuer,
            address _usdcToken
        ) 
    {
        return (groveToken, farmer, issuer, USDC);
    }
}