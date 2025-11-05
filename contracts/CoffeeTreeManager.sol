// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "./system-contracts/hedera-token-service/HederaTokenService.sol";
import "./system-contracts/HederaResponseCodes.sol";
import "./system-contracts/hedera-token-service/IHederaTokenService.sol";
import "./system-contracts/hedera-token-service/KeyHelper.sol";
import "./system-contracts/hedera-token-service/ExpiryHelper.sol";
import "./system-contracts/hedera-token-service/IHRC719.sol";
import "./@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title CoffeeTreeManager
 * @notice Manages coffee grove tokens and metadata using Hedera Token Service (HTS)
 * 
 * @dev This contract implements a TWO-PHASE INITIALIZATION PATTERN to avoid
 * CONTRACT_REVERT_EXECUTED errors when creating HTS tokens.
 * 
 * TWO-PHASE PATTERN:
 * Phase 1 (Constructor): Deploy contract and initialize state variables
 *                        - Does NOT create HTS token
 *                        - Stores token parameters for later use
 *                        - Gas Required: ~3,000,000
 * 
 * Phase 2 (initializeToken): Create HTS token in separate transaction
 *                            - Called after deployment
 *                            - Creates token with simplified key configuration
 *                            - Gas Required: ~2,500,000
 * 
 * WHY TWO-PHASE?
 * HTS token creation requires significant gas and cannot be reliably executed
 * within a contract constructor. Separating deployment from token creation
 * ensures successful contract deployment and token initialization.
 * 
 * USAGE:
 * 1. Deploy contract with constructor parameters
 * 2. Call initializeToken() to create HTS token
 * 3. Use token operations (mint, burn, etc.) after initialization
 */
contract CoffeeTreeManager is HederaTokenService, KeyHelper, ExpiryHelper {
    
    // Custom errors for better error handling
    error TokenNotInitialized();
    error TokenAlreadyInitialized();
    error HTSTokenCreationFailed(int responseCode);
    
    // Tree metadata structure
    struct TreeMetadata {
        string location;
        string coffeeVariety;
        uint64 plantingDate;
        uint64 expectedYieldPerSeason;
        uint8 currentHealthScore;
        string farmingPractices;
        uint256 lastHealthUpdate;
    }

    // Health monitoring structure
    struct HealthUpdate {
        uint256 updateDate;
        uint8 healthScore;
        string notes;
        address updatedBy;
    }

    // State variables
    address public token;
    address public controller;
    address public admin;
    address public farmer;
    uint64 public totalSupply;
    string public groveName;
    
    TreeMetadata public treeMetadata;
    HealthUpdate[] public healthHistory;
    
    // Token initialization state
    string private tokenSymbol;
    bool private tokenInitialized;
    
    // Events
    event TreeHealthUpdated(
        uint8 indexed newHealthScore,
        string notes,
        address indexed updatedBy,
        uint256 timestamp
    );
    
    event TreeMetadataUpdated(
        string field,
        string newValue,
        address indexed updatedBy,
        uint256 timestamp
    );
    
    event FarmingPracticesUpdated(
        string newPractices,
        address indexed updatedBy,
        uint256 timestamp
    );
    
    event TokenInitialized(
        address indexed tokenAddress,
        string groveName,
        uint256 timestamp
    );

    receive() external payable {
        // do nothing
    }

    fallback() external payable {
        // do nothing
    }

    modifier onlyAdmin() {
        require(msg.sender == admin || msg.sender == address(this), "Only admin can call this function"); 
        _;
    }

    modifier onlyFarmer() {
        require(msg.sender == farmer, "Only farmer can call this function");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == admin || 
            msg.sender == farmer || 
            msg.sender == address(this), 
            "Not authorized"
        );
        _;
    }

    /**
     * @notice PHASE 1: Contract deployment and state initialization
     * @dev Constructor does NOT create HTS token to avoid CONTRACT_REVERT_EXECUTED errors
     * 
     * Gas Required: ~3,000,000
     * 
     * What happens in Phase 1:
     * - Initialize admin, controller, and grove name
     * - Store token symbol for Phase 2
     * - Initialize tree metadata (location, variety, health, etc.)
     * - Set initial health score to 100 (perfect health)
     * 
     * What does NOT happen in Phase 1:
     * - HTS token creation (moved to initializeToken())
     * - Token minting
     * - KYC grants
     * 
     * @param _groveName Name of the coffee grove
     * @param _symbol Token symbol (stored for Phase 2)
     * @param _location Geographic location of the grove
     * @param _coffeeVariety Type of coffee variety (e.g., "Arabica")
     * @param _expectedYieldPerSeason Expected yield per season (scaled by 1000)
     */
    constructor(
        string memory _groveName,
        string memory _symbol,
        string memory _location,
        string memory _coffeeVariety,
        uint64 _expectedYieldPerSeason
    ) payable {
        admin = msg.sender;
        controller = address(this);
        groveName = _groveName;
        
        // Store token symbol for Phase 2 initialization
        tokenSymbol = _symbol;
        
        // Initialize tree metadata
        treeMetadata = TreeMetadata({
            location: _location,
            coffeeVariety: _coffeeVariety,
            plantingDate: uint64(block.timestamp),
            expectedYieldPerSeason: _expectedYieldPerSeason,
            currentHealthScore: 100, // Start with perfect health
            farmingPractices: "Organic farming practices",
            lastHealthUpdate: block.timestamp
        });
        
        // IMPORTANT: Token initialization will be done separately via initializeToken()
        // This avoids CONTRACT_REVERT_EXECUTED errors during deployment
    }
    
    /**
     * @notice PHASE 2: Initialize HTS token after contract deployment
     * @dev This function creates the HTS token with simplified key configuration
     * 
     * Gas Required: ~4,000,000 (increased for full key configuration)
     * 
     * KEY CONFIGURATION:
     * Configures all 7 HTS keys for maximum flexibility:
     * - ADMIN: Contract administration
     * - KYC: Token holder verification
     * - FREEZE: Account freeze capability
     * - WIPE: Token wipe capability
     * - SUPPLY: Token minting and burning
     * - FEE: Custom fee configuration
     * - PAUSE: Token pause capability
     * 
     * IMPORTANT: This function can only be called once. After successful
     * initialization, the token address is set and cannot be changed.
     * 
     * @dev Reverts with TokenAlreadyInitialized if token is already initialized
     * @dev Reverts with HTSTokenCreationFailed if HTS token creation fails
     */
    function initializeToken() external onlyAdmin {
        // Prevent double initialization
        if (token != address(0)) revert TokenAlreadyInitialized();
        
        // Configure token details (matching working CoffeeTreeManagerSimplified)
        IHederaTokenService.HederaToken memory tokenDetails;
        tokenDetails.name = groveName;
        tokenDetails.symbol = tokenSymbol;
        tokenDetails.treasury = address(this);
        
        // Note: Metadata is optional for token creation
        // For HIP-405 compliance, metadata should be an IPFS CID pointing to a JSON file
        // For now, leaving metadata empty - can be set later if a metadata key is configured
        // tokenDetails.metadata = bytes(""); // Optional: Add IPFS CID here
        
        // Use ExpiryHelper for proper expiry configuration
        tokenDetails.expiry = createAutoRenewExpiry(address(this), 7890000);
        
        // Configure only essential keys to reduce gas and cost
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](3);
        
        keys[0] = getSingleKey(
            KeyType.ADMIN,
            KeyValueType.CONTRACT_ID,
            address(this)
        );
        keys[1] = getSingleKey(
            KeyType.SUPPLY,
            KeyValueType.CONTRACT_ID,
            address(this)
        );
        keys[2] = getSingleKey(
            KeyType.KYC,
            KeyValueType.CONTRACT_ID,
            address(this)
        );
        
        tokenDetails.tokenKeys = keys;
        
        // Create the HTS token (using inherited method from HederaTokenService)
        (int responseCode, address tokenAddress) = createFungibleToken(
            tokenDetails,
            0, // initialTotalSupply
            0  // decimals
        );
        
        // Check for success - use simple revert to avoid string conversion issues
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert HTSTokenCreationFailed(responseCode);
        }
        require(tokenAddress != address(0), "Invalid token address returned");
        
        // Store token address and mark as initialized
        token = tokenAddress;
        tokenInitialized = true;
        
        emit TokenInitialized(tokenAddress, groveName, block.timestamp);
    }
    
    /**
     * @dev Check if token has been initialized
     * @return bool True if token is initialized, false otherwise
     */
    function isTokenInitialized() external view returns (bool) {
        return token != address(0);
    }
    
    /**
     * @dev Modifier to check if token is initialized
     */
    modifier requiresTokenInitialization() {
        if (token == address(0)) revert TokenNotInitialized();
        _;
    }
    
    /**
     * @dev Set the farmer address (called by issuer during grove registration)
     */
    function setFarmer(address _farmer) external onlyAdmin {
        farmer = _farmer;
    }

    /**
     * @dev Mint new tree tokens
     */
    function mint(uint64 amount) public onlyAdmin() requiresTokenInitialization() {
        (int responseCode, int64 _newTotalSupply, ) = HederaTokenService.mintToken(token, int64(amount), new bytes[](0));

        if(responseCode != HederaResponseCodes.SUCCESS){
            revert("Failed to mint tree tokens");
        }

        totalSupply = uint64(_newTotalSupply);
    }

    /**
     * @dev Burn tree tokens
     */
    function burn(uint64 amount) public onlyAdmin() requiresTokenInitialization() {
       (int responseCode, int64 _newTokenSupply) = HederaTokenService.burnToken(token, int64(amount), new int64[](0));

       if(responseCode != HederaResponseCodes.SUCCESS){
            revert("Failed to burn tree tokens");
       }

         totalSupply = uint64(_newTokenSupply);
    }

    /**
     * @dev Grant KYC to an account
     */
    function grantKYC(address account) public onlyAdmin() requiresTokenInitialization() {
        (, bool isKYCed) = HederaTokenService.isKyc(token, account);

        if(!isKYCed){
            int responseCode = HederaTokenService.grantTokenKyc(token, account);

            if(responseCode != HederaResponseCodes.SUCCESS){
                revert("Failed to grant KYC");
            }
        }
    }

    /**
     * @dev Airdrop purchased tokens to investor
     */
    function airdropPurchasedTokens(address target, uint64 amount) public onlyAdmin() requiresTokenInitialization() {
        bool isAssociated = IHRC719(token).isAssociated();

        if(!isAssociated){
            revert("Token is not associated");
        }

        IHederaTokenService.AccountAmount memory recipientAccount; 
        recipientAccount.accountID = target;
        recipientAccount.amount = int64(amount);

        IHederaTokenService.AccountAmount memory senderAccount;
        senderAccount.accountID = address(this);
        senderAccount.amount = -int64(amount);

        IHederaTokenService.TokenTransferList memory transferList;
        transferList.token = token;
        transferList.transfers = new IHederaTokenService.AccountAmount[](2);
        transferList.transfers[0] = senderAccount;
        transferList.transfers[1] = recipientAccount;

        IHederaTokenService.TokenTransferList[] memory airdropList = new IHederaTokenService.TokenTransferList[](1);
        airdropList[0] = transferList;

        int responseCode = HederaTokenService.airdropTokens(airdropList);

        if(responseCode != HederaResponseCodes.SUCCESS){
            revert("Failed to airdrop tokens");
        }
    }    /**

     * @dev Update tree health score and notes
     */
    function updateTreeHealth(
        uint8 _healthScore,
        string memory _notes
    ) external onlyAuthorized {
        require(_healthScore >= 0 && _healthScore <= 100, "Health score must be between 0-100");
        require(bytes(_notes).length > 0, "Notes cannot be empty");

        // Update metadata
        treeMetadata.currentHealthScore = _healthScore;
        treeMetadata.lastHealthUpdate = block.timestamp;

        // Add to health history
        HealthUpdate memory update = HealthUpdate({
            updateDate: block.timestamp,
            healthScore: _healthScore,
            notes: _notes,
            updatedBy: msg.sender
        });
        
        healthHistory.push(update);

        emit TreeHealthUpdated(_healthScore, _notes, msg.sender, block.timestamp);
    }

    /**
     * @dev Update farming practices
     */
    function updateFarmingPractices(string memory _newPractices) external onlyFarmer {
        require(bytes(_newPractices).length > 0, "Farming practices cannot be empty");
        
        treeMetadata.farmingPractices = _newPractices;

        emit FarmingPracticesUpdated(_newPractices, msg.sender, block.timestamp);
    }

    /**
     * @dev Update expected yield per season
     */
    function updateExpectedYield(uint64 _newExpectedYield) external onlyFarmer {
        require(_newExpectedYield > 0, "Expected yield must be positive");
        
        treeMetadata.expectedYieldPerSeason = _newExpectedYield;

        emit TreeMetadataUpdated(
            "expectedYieldPerSeason",
            Strings.toString(_newExpectedYield),
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Update coffee variety (in case of replanting)
     */
    function updateCoffeeVariety(string memory _newVariety) external onlyFarmer {
        require(bytes(_newVariety).length > 0, "Coffee variety cannot be empty");
        
        treeMetadata.coffeeVariety = _newVariety;

        emit TreeMetadataUpdated(
            "coffeeVariety",
            _newVariety,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Get complete tree metadata
     */
    function getTreeMetadata() external view returns (TreeMetadata memory) {
        return treeMetadata;
    }

    /**
     * @dev Get health history
     */
    function getHealthHistory() external view returns (HealthUpdate[] memory) {
        return healthHistory;
    }

    /**
     * @dev Get latest health update
     */
    function getLatestHealthUpdate() external view returns (HealthUpdate memory) {
        require(healthHistory.length > 0, "No health updates available");
        return healthHistory[healthHistory.length - 1];
    }

    /**
     * @dev Get current health score
     */
    function getCurrentHealthScore() external view returns (uint8) {
        return treeMetadata.currentHealthScore;
    }

    /**
     * @dev Get expected yield for current season
     */
    function getExpectedYield() external view returns (uint64) {
        return treeMetadata.expectedYieldPerSeason;
    }

    /**
     * @dev Get coffee variety
     */
    function getCoffeeVariety() external view returns (string memory) {
        return treeMetadata.coffeeVariety;
    }

    /**
     * @dev Get grove location
     */
    function getLocation() external view returns (string memory) {
        return treeMetadata.location;
    }

    /**
     * @dev Get farming practices
     */
    function getFarmingPractices() external view returns (string memory) {
        return treeMetadata.farmingPractices;
    }

    /**
     * @dev Calculate health-adjusted yield projection
     */
    function getHealthAdjustedYieldProjection() external view returns (uint64) {
        uint64 baseYield = treeMetadata.expectedYieldPerSeason;
        uint8 healthScore = treeMetadata.currentHealthScore;
        
        // Adjust yield based on health score (health score is 0-100)
        return (baseYield * healthScore) / 100;
    }

    /**
     * @dev Check if trees need attention based on health score
     */
    function needsAttention() external view returns (bool) {
        return treeMetadata.currentHealthScore < 70; // Below 70% health needs attention
    }

    /**
     * @dev Get days since last health update
     */
    function daysSinceLastHealthUpdate() external view returns (uint256) {
        if (treeMetadata.lastHealthUpdate == 0) {
            return 0;
        }
        return (block.timestamp - treeMetadata.lastHealthUpdate) / 86400; // 86400 seconds in a day
    }

    /**
     * @dev Airdrop revenue tokens to multiple holders (for revenue distribution)
     */
    function airdropRevenueTokens(
        address[] memory holders,
        uint64[] memory amounts
    ) external onlyAdmin requiresTokenInitialization {
        require(holders.length == amounts.length, "Arrays length mismatch");
        require(holders.length > 0, "No holders provided");

        for (uint256 i = 0; i < holders.length; i++) {
            if (amounts[i] > 0) {
                airdropPurchasedTokens(holders[i], amounts[i]);
            }
        }
    }

    /**
     * @dev Get token statistics
     */
    function getTokenStats() external view returns (
        uint64 _totalSupply,
        uint256 _circulatingSupply,
        address _tokenAddress
    ) {
        _totalSupply = totalSupply;
        _circulatingSupply = totalSupply; // For now, all tokens are circulating
        _tokenAddress = token;
    }
}