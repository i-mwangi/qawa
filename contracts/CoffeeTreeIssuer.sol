// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "./system-contracts/hedera-token-service/HederaTokenService.sol";
import "./system-contracts/HederaResponseCodes.sol";
import "./system-contracts/hedera-token-service/IHederaTokenService.sol";
import "./system-contracts/hedera-token-service/KeyHelper.sol";
import "./PriceOracle.sol";
import "./CoffeeRevenueReserve.sol";
import "./CoffeeTreeManager.sol";
import "./FarmerVerification.sol";
import "./CoffeeTreeMarketplace.sol";
import "./interfaces/IERC20.sol";

function stringToBytes32(string memory source) pure returns (bytes32 result) {
    bytes memory temp = bytes(source);
    if (temp.length == 0) {
        return 0x0;
    }
    assembly {
        result := mload(add(temp, 32))
    }
}

contract CoffeeTreeIssuer {
    
    // Events for coffee tree specific operations
    event CoffeeGroveRegistered(
        bytes32 indexed groveName, 
        address indexed farmer, 
        uint64 treeCount,
        string location,
        string coffeeVariety
    );
    
    event CoffeeGroveTokenized(
        bytes32 indexed groveName,
        address indexed token,
        uint64 totalTokens,
        uint64 tokensPerTree
    );
    
    event TreeTokensPurchased(
        address indexed grove, 
        uint64 indexed amount, 
        address indexed investor,
        uint64 totalCost
    );
    
    event TreeTokensSold(
        address indexed grove, 
        uint64 indexed amount, 
        address indexed seller,
        uint64 refundAmount
    );
    
    event HarvestReported(
        bytes32 indexed groveName, 
        uint64 yieldKg, 
        uint64 totalRevenue,
        uint64 qualityGrade,
        uint256 harvestDate,
        uint256 indexed harvestIndex
    );
    
    event RevenueDistributed(
        bytes32 indexed groveName, 
        uint64 totalRevenue, 
        uint64 farmerShare,
        uint64 investorShare,
        uint256 timestamp,
        uint256 indexed harvestIndex
    );

    event HarvestValidationFailed(
        bytes32 indexed groveName,
        address indexed farmer,
        string reason,
        uint256 timestamp
    );

    event RevenueCalculated(
        bytes32 indexed groveName,
        uint256 indexed harvestIndex,
        uint64 totalRevenue,
        uint64 farmerShare,
        uint64 investorShare,
        uint256 timestamp
    );

    // Structs for coffee grove data
    struct CoffeeGrove {
        string groveName;
        address farmer;
        string location;
        uint64 treeCount;
        string coffeeVariety;
        uint64 expectedYieldPerTree;
        bool isTokenized;
        address tokenAddress;
        uint64 totalTokens;
        uint64 tokensPerTree;
        uint256 registrationDate;
    }

    struct HarvestRecord {
        uint64 harvestDate;
        uint64 yieldKg;
        uint64 qualityGrade;
        uint64 salePricePerKg;
        uint64 totalRevenue;
        bool revenueDistributed;
    }

    // State variables
    address public admin;
    PriceOracle constant oracle = PriceOracle(address(0x0000000000000000000000000000000000588104));
    IHederaTokenService constant hts = IHederaTokenService(address(0x167));
    address constant USDC = address(0x5880fb); // Using USDC instead of KES for coffee payments
    FarmerVerification public farmerVerification;
    CoffeeTreeMarketplace public marketplace;
    
    mapping(string => CoffeeGrove) public coffeeGroves;
    mapping(string => CoffeeTreeManager) public groveTokenManagers;
    mapping(address => CoffeeRevenueReserve) public groveReserves;
    mapping(string => HarvestRecord[]) public groveHarvests;
    mapping(address => bool) public verifiedFarmers;
    
    string[] public registeredGroveNames;

    // Custom errors
    error UnverifiedFarmer(address farmer);
    error GroveNotFound(string groveName);
    error GroveAlreadyExists(string groveName);
    error GroveNotTokenized(string groveName);
    error InsufficientTokens(uint64 requested, uint64 available);
    error InvalidHarvestData(string reason);
    error RevenueAlreadyDistributed(uint256 harvestIndex);
    error UnauthorizedAccess(address caller);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    modifier onlyVerifiedFarmer() {
        if (!farmerVerification.isVerifiedFarmer(msg.sender)) {
            revert UnverifiedFarmer(msg.sender);
        }
        _;
    }

    modifier onlyGroveOwner(string memory groveName) {
        CoffeeGrove memory grove = coffeeGroves[groveName];
        if (grove.farmer == address(0)) {
            revert GroveNotFound(groveName);
        }
        if (grove.farmer != msg.sender) {
            revert UnauthorizedAccess(msg.sender);
        }
        _;
    }

    receive() external payable {
        // do nothing
    }

    fallback() external payable {
        // do nothing
    }

    constructor(address _farmerVerification) {
        admin = msg.sender;
        farmerVerification = FarmerVerification(_farmerVerification);
    }

    /**
     * @dev Set marketplace contract address (admin only)
     */
    function setMarketplace(address _marketplace) external onlyAdmin {
        marketplace = CoffeeTreeMarketplace(_marketplace);
    }

    /**
     * @dev Register a new coffee grove with metadata
     */
    function registerCoffeeGrove(
        string memory _groveName,
        string memory _location,
        uint64 _treeCount,
        string memory _coffeeVariety,
        uint64 _expectedYieldPerTree
    ) external onlyVerifiedFarmer {
        // Check if grove already exists
        if (coffeeGroves[_groveName].farmer != address(0)) {
            revert GroveAlreadyExists(_groveName);
        }

        // Validate input parameters
        require(_treeCount > 0, "Tree count must be positive");
        require(_expectedYieldPerTree > 0, "Expected yield must be positive");
        require(bytes(_groveName).length > 0, "Grove name cannot be empty");
        require(bytes(_location).length > 0, "Location cannot be empty");
        require(bytes(_coffeeVariety).length > 0, "Coffee variety cannot be empty");

        // Create grove record
        CoffeeGrove storage grove = coffeeGroves[_groveName];
        grove.groveName = _groveName;
        grove.farmer = msg.sender;
        grove.location = _location;
        grove.treeCount = _treeCount;
        grove.coffeeVariety = _coffeeVariety;
        grove.expectedYieldPerTree = _expectedYieldPerTree;
        grove.isTokenized = false;
        grove.registrationDate = block.timestamp;

        registeredGroveNames.push(_groveName);

        emit CoffeeGroveRegistered(
            stringToBytes32(_groveName),
            msg.sender,
            _treeCount,
            _location,
            _coffeeVariety
        );
    }

    /**
     * @dev Create grove token and contracts in a single transaction to avoid gas limits
     * This is the first step in the two-phase tokenization process
     * 
     * @param _groveName Name of the grove to tokenize
     * @param _tokensPerTree Number of tokens to create per tree
     * @return tokenAddress Address of the created HTS token (will be zero until step 2)
     * @return managerAddress Address of the CoffeeTreeManager contract
     * @return reserveAddress Address of the CoffeeRevenueReserve contract (will be zero until step 2)
     */
    function createGroveTokenAndContracts(
        string memory _groveName,
        uint64 _tokensPerTree
    ) external payable onlyGroveOwner(_groveName) returns (address tokenAddress, address managerAddress, address reserveAddress) {
        CoffeeGrove storage grove = coffeeGroves[_groveName];
        
        require(!grove.isTokenized, "Grove already tokenized");
        require(_tokensPerTree > 0, "Tokens per tree must be positive");
        require(grove.treeCount > 0, "Tree count must be positive");

        // Phase 1: Deploy CoffeeTreeManager without token creation
        string memory tokenSymbol = string(abi.encodePacked("TREE-", _groveName));
        CoffeeTreeManager tokenManager = new CoffeeTreeManager{value: msg.value}(
            _groveName,
            tokenSymbol,
            grove.location,
            grove.coffeeVariety,
            grove.expectedYieldPerTree
        );
        
        // Store manager reference for later use
        groveTokenManagers[_groveName] = tokenManager;
        managerAddress = address(tokenManager);
        
        // Token address and reserve address will be set in subsequent steps
        tokenAddress = address(0);
        reserveAddress = address(0);
        
        // Note: Token initialization will be done in a separate transaction via the manager contract
        // This avoids CONTRACT_REVERT_EXECUTED errors on Hedera due to gas limits
        
        emit CoffeeGroveRegistered(
            stringToBytes32(_groveName),
            msg.sender,
            grove.treeCount,
            grove.location,
            grove.coffeeVariety
        );
        
        // Explicitly return the addresses
        return (tokenAddress, managerAddress, reserveAddress);
    }
    
    /**
     * @dev Initialize the HTS token for a grove (second step in tokenization)
     * This function should be called after createGroveTokenAndContracts
     * 
     * @param _groveName Name of the grove to initialize
     * @param _tokensPerTree Number of tokens per tree
     * @return tokenAddress Address of the created HTS token
     * @return reserveAddress Address of the CoffeeRevenueReserve contract
     */
    function initializeGroveToken(
        string memory _groveName,
        uint64 _tokensPerTree
    ) external onlyGroveOwner(_groveName) returns (address tokenAddress, address reserveAddress) {
        CoffeeGrove storage grove = coffeeGroves[_groveName];
        
        require(!grove.isTokenized, "Grove already tokenized");
        require(_tokensPerTree > 0, "Tokens per tree must be positive");
        
        // Get the manager contract
        CoffeeTreeManager tokenManager = groveTokenManagers[_groveName];
        require(address(tokenManager) != address(0), "Manager contract not found");
        
        // Initialize token in separate transaction to avoid gas limits
        tokenManager.initializeToken();
        
        // Verify token address is set after initialization
        tokenAddress = tokenManager.token();
        require(tokenAddress != address(0), "Token initialization failed: token address is zero");
        
        // Create revenue reserve with initialized token
        CoffeeRevenueReserve reserve = new CoffeeRevenueReserve(
            tokenAddress,
            msg.sender,
            USDC
        );
        reserveAddress = address(reserve);
        
        // Update grove data
        grove.isTokenized = true;
        grove.tokenAddress = tokenAddress;
        grove.tokensPerTree = _tokensPerTree;
        groveReserves[tokenAddress] = reserve;
        
        emit CoffeeGroveTokenized(
            stringToBytes32(_groveName),
            tokenAddress,
            0, // Will be set after minting
            _tokensPerTree
        );
        
        // Explicitly return the addresses
        return (tokenAddress, reserveAddress);
    }
    
    /**
     * @dev Mint initial token supply for a grove (third step in tokenization)
     * This function should be called after initializeGroveToken
     * 
     * @param _groveName Name of the grove to mint tokens for
     * @param _tokensPerTree Number of tokens per tree
     */
    function mintGroveTokens(
        string memory _groveName,
        uint64 _tokensPerTree
    ) external onlyGroveOwner(_groveName) {
        CoffeeGrove storage grove = coffeeGroves[_groveName];
        
        require(grove.isTokenized, "Grove not yet tokenized");
        require(_tokensPerTree > 0, "Tokens per tree must be positive");
        
        // Calculate total tokens
        uint64 totalTokens = grove.treeCount * _tokensPerTree;
        
        // Get the manager contract
        CoffeeTreeManager tokenManager = groveTokenManagers[_groveName];
        require(address(tokenManager) != address(0), "Manager contract not found");
        
        // Mint initial token supply
        tokenManager.mint(totalTokens);
        
        // Update grove data
        grove.totalTokens = totalTokens;
        
        emit CoffeeGroveTokenized(
            stringToBytes32(_groveName),
            grove.tokenAddress,
            totalTokens,
            _tokensPerTree
        );
    }
    
    /**
     * @dev Original tokenizeCoffeeGrove function (deprecated but kept for backward compatibility)
     * This function may cause CONTRACT_REVERT_EXECUTED errors on Hedera due to gas limits
     * Use the three-step process instead: createGroveTokenAndContracts -> initializeGroveToken -> mintGroveTokens
     */
    function tokenizeCoffeeGrove(
        string memory _groveName,
        uint64 _tokensPerTree,
        uint64 _pricePerToken
    ) external payable onlyGroveOwner(_groveName) {
        CoffeeGrove storage grove = coffeeGroves[_groveName];
        
        require(!grove.isTokenized, "Grove already tokenized");
        require(_tokensPerTree > 0, "Tokens per tree must be positive");
        require(_pricePerToken > 0, "Price per token must be positive");

        // Calculate total tokens
        uint64 totalTokens = grove.treeCount * _tokensPerTree;

        // Phase 1: Deploy CoffeeTreeManager without token creation
        string memory tokenSymbol = string(abi.encodePacked("TREE-", _groveName));
        CoffeeTreeManager tokenManager = new CoffeeTreeManager{value: msg.value}(
            _groveName,
            tokenSymbol,
            grove.location,
            grove.coffeeVariety,
            grove.expectedYieldPerTree
        );
        
        // Phase 2: Initialize token in separate transaction
        try tokenManager.initializeToken() {
            // Token initialization succeeded
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("Token initialization failed: ", reason)));
        } catch (bytes memory) {
            revert("Token initialization failed with unknown error");
        }
        
        // Verify token address is set after initialization
        address tokenAddress = tokenManager.token();
        require(tokenAddress != address(0), "Token initialization failed: token address is zero");
        
        // Create revenue reserve with initialized token
        CoffeeRevenueReserve reserve = new CoffeeRevenueReserve(
            tokenAddress,
            msg.sender,
            USDC
        );

        // Update grove data
        grove.isTokenized = true;
        grove.tokenAddress = tokenAddress;
        grove.totalTokens = totalTokens;
        grove.tokensPerTree = _tokensPerTree;

        // Store references
        groveTokenManagers[_groveName] = tokenManager;
        groveReserves[tokenAddress] = reserve;

        // Mint initial token supply
        tokenManager.mint(totalTokens);

        emit CoffeeGroveTokenized(
            stringToBytes32(_groveName),
            tokenAddress,
            totalTokens,
            _tokensPerTree
        );
    }    /**

     * @dev Purchase coffee tree tokens from a tokenized grove
     */
    function purchaseTreeTokens(
        string memory _groveName,
        uint64 _amount
    ) external {
        CoffeeGrove memory grove = coffeeGroves[_groveName];
        
        if (grove.farmer == address(0)) {
            revert GroveNotFound(_groveName);
        }
        if (!grove.isTokenized) {
            revert GroveNotTokenized(_groveName);
        }

        CoffeeTreeManager tokenManager = groveTokenManagers[_groveName];
        address token = tokenManager.token();
        CoffeeRevenueReserve reserve = groveReserves[token];

        // Check available tokens
        uint256 availableTokens = IERC20(token).balanceOf(address(tokenManager));
        if (_amount > availableTokens) {
            revert InsufficientTokens(_amount, uint64(availableTokens));
        }

        // Get price from oracle (price per token in USDC)
        uint64 pricePerToken = oracle.getPrice(token);
        uint64 totalCost = pricePerToken * _amount;

        // Transfer USDC from buyer to reserve
        int responseCode = hts.transferFrom(USDC, msg.sender, address(reserve), totalCost);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer USDC");
        }

        // Grant KYC to buyer if needed
        tokenManager.grantKYC(msg.sender);

        // Transfer tokens to buyer
        tokenManager.airdropPurchasedTokens(msg.sender, _amount);
        
        // Update reserve
        reserve.deposit(totalCost);

        emit TreeTokensPurchased(token, _amount, msg.sender, totalCost);
    }

    /**
     * @dev Sell coffee tree tokens back to the grove
     */
    function sellTreeTokens(
        string memory _groveName,
        uint64 _amount
    ) external {
        CoffeeGrove memory grove = coffeeGroves[_groveName];
        
        if (grove.farmer == address(0)) {
            revert GroveNotFound(_groveName);
        }
        if (!grove.isTokenized) {
            revert GroveNotTokenized(_groveName);
        }

        CoffeeTreeManager tokenManager = groveTokenManagers[_groveName];
        address token = tokenManager.token();
        CoffeeRevenueReserve reserve = groveReserves[token];

        // Get current price
        uint64 pricePerToken = oracle.getPrice(token);
        uint64 refundAmount = pricePerToken * _amount;

        // Transfer tokens from seller to token manager
        int responseCode = hts.transferFrom(token, msg.sender, address(tokenManager), _amount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer tokens");
        }

        // Refund USDC to seller
        reserve.refund(refundAmount, msg.sender);

        emit TreeTokensSold(token, _amount, msg.sender, refundAmount);
    }

    /**
     * @dev Report harvest data for a coffee grove with enhanced validation
     */
    function reportHarvest(
        string memory _groveName,
        uint64 _yieldKg,
        uint64 _qualityGrade,
        uint64 _salePricePerKg
    ) external onlyGroveOwner(_groveName) {
        CoffeeGrove memory grove = coffeeGroves[_groveName];
        
        if (!grove.isTokenized) {
            revert GroveNotTokenized(_groveName);
        }

        // Enhanced harvest data validation
        _validateHarvestData(_groveName, _yieldKg, _qualityGrade, _salePricePerKg, grove);

        uint64 totalRevenue = _yieldKg * _salePricePerKg;

        // Create harvest record with enhanced data
        HarvestRecord memory harvest = HarvestRecord({
            harvestDate: uint64(block.timestamp),
            yieldKg: _yieldKg,
            qualityGrade: _qualityGrade,
            salePricePerKg: _salePricePerKg,
            totalRevenue: totalRevenue,
            revenueDistributed: false
        });

        groveHarvests[_groveName].push(harvest);
        uint256 harvestIndex = groveHarvests[_groveName].length - 1;

        emit HarvestReported(
            stringToBytes32(_groveName),
            _yieldKg,
            totalRevenue,
            _qualityGrade,
            block.timestamp,
            harvestIndex
        );
    }

    /**
     * @dev Internal function to validate harvest data with comprehensive checks
     */
    function _validateHarvestData(
        string memory _groveName,
        uint64 _yieldKg,
        uint64 _qualityGrade,
        uint64 _salePricePerKg,
        CoffeeGrove memory grove
    ) internal view {
        // Basic validation
        if (_yieldKg == 0) {
            revert InvalidHarvestData("Yield cannot be zero");
        }
        if (_qualityGrade == 0 || _qualityGrade > 100) {
            revert InvalidHarvestData("Quality grade must be between 1-100");
        }
        if (_salePricePerKg == 0) {
            revert InvalidHarvestData("Sale price cannot be zero");
        }

        // Validate yield against expected capacity
        uint64 maxExpectedYield = grove.treeCount * grove.expectedYieldPerTree;
        uint64 maxReasonableYield = maxExpectedYield * 150 / 100; // Allow 50% over expected
        if (_yieldKg > maxReasonableYield) {
            revert InvalidHarvestData("Yield exceeds reasonable maximum for grove size");
        }

        // Validate price against market rates (basic check)
        uint64 marketPrice = oracle.getPrice(grove.tokenAddress);
        if (marketPrice > 0) {
            uint64 minPrice = marketPrice * 50 / 100; // 50% below market
            uint64 maxPrice = marketPrice * 200 / 100; // 200% above market
            if (_salePricePerKg < minPrice || _salePricePerKg > maxPrice) {
                revert InvalidHarvestData("Sale price deviates significantly from market rates");
            }
        }

        // Check for duplicate harvests in same time period (prevent spam)
        HarvestRecord[] memory harvests = groveHarvests[_groveName];
        if (harvests.length > 0) {
            HarvestRecord memory lastHarvest = harvests[harvests.length - 1];
            uint256 timeSinceLastHarvest = block.timestamp - lastHarvest.harvestDate;
            if (timeSinceLastHarvest < 7 days) {
                revert InvalidHarvestData("Cannot report harvest within 7 days of previous harvest");
            }
        }
    }

    /**
     * @dev Distribute revenue from a harvest to token holders with enhanced safeguards
     */
    function distributeRevenue(
        string memory _groveName,
        uint256 _harvestIndex
    ) external onlyGroveOwner(_groveName) {
        CoffeeGrove memory grove = coffeeGroves[_groveName];
        
        if (!grove.isTokenized) {
            revert GroveNotTokenized(_groveName);
        }

        HarvestRecord[] storage harvests = groveHarvests[_groveName];
        if (_harvestIndex >= harvests.length) {
            revert InvalidHarvestData("Invalid harvest index");
        }

        HarvestRecord storage harvest = harvests[_harvestIndex];
        if (harvest.revenueDistributed) {
            revert RevenueAlreadyDistributed(_harvestIndex);
        }

        // Validate harvest is not too old (prevent stale distributions)
        if (block.timestamp - harvest.harvestDate > 365 days) {
            revert InvalidHarvestData("Harvest too old for distribution");
        }

        CoffeeTreeManager tokenManager = groveTokenManagers[_groveName];
        address token = tokenManager.token();
        CoffeeRevenueReserve reserve = groveReserves[token];

        // Calculate shares (70% to investors, 30% to farmer)
        uint64 totalRevenue = harvest.totalRevenue;
        uint64 farmerShare = (totalRevenue * 30) / 100;
        uint64 investorShare = totalRevenue - farmerShare;

        // Ensure reserve has sufficient funds
        uint256 availableBalance = reserve.getAvailableBalance();
        if (totalRevenue > availableBalance) {
            revert InvalidHarvestData("Insufficient reserve balance for distribution");
        }

        // First, deposit the revenue to the reserve (farmer must have transferred USDC)
        _depositHarvestRevenue(_groveName, totalRevenue);

        // Distribute to token holders
        reserve.distributeRevenue(token, investorShare);

        // Get token holders and distribute
        _distributeToTokenHolders(_groveName, token, investorShare);

        // Transfer farmer share
        reserve.withdrawFarmerShare(farmerShare, msg.sender);

        // Mark as distributed
        harvest.revenueDistributed = true;

        // Emit revenue calculation event
        emit RevenueCalculated(
            stringToBytes32(_groveName),
            _harvestIndex,
            totalRevenue,
            farmerShare,
            investorShare,
            block.timestamp
        );

        emit RevenueDistributed(
            stringToBytes32(_groveName),
            totalRevenue,
            farmerShare,
            investorShare,
            block.timestamp,
            _harvestIndex
        );
    }

    /**
     * @dev Internal function to deposit harvest revenue to reserve
     */
    function _depositHarvestRevenue(string memory _groveName, uint64 _totalRevenue) internal {
        CoffeeTreeManager tokenManager = groveTokenManagers[_groveName];
        address token = tokenManager.token();
        CoffeeRevenueReserve reserve = groveReserves[token];

        // Transfer USDC from farmer to reserve
        int responseCode = hts.transferFrom(USDC, msg.sender, address(reserve), _totalRevenue);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer harvest revenue to reserve");
        }

        // Deposit to reserve
        reserve.deposit(_totalRevenue);
    }

    /**
     * @dev Internal function to distribute revenue to token holders
     */
    function _distributeToTokenHolders(
        string memory _groveName,
        address token,
        uint64 investorShare
    ) internal {
        CoffeeRevenueReserve reserve = groveReserves[token];
        
        // Get all token holders (this is a simplified approach)
        // In a real implementation, you'd need to track holders more efficiently
        address[] memory holders = _getTokenHolders(token);
        uint64[] memory balances = new uint64[](holders.length);
        
        for (uint256 i = 0; i < holders.length; i++) {
            balances[i] = uint64(IERC20(token).balanceOf(holders[i]));
        }

        // Get the latest distribution ID
        uint256 distributionId = reserve.distributionCounter();
        
        // Distribute to holders
        reserve.distributeRevenueToHolders(distributionId, holders, balances);
    }

    /**
     * @dev Get all token holders for a given token (simplified implementation)
     * Note: In production, this should be tracked more efficiently
     */
    function _getTokenHolders(address token) internal view returns (address[] memory) {
        // This is a placeholder implementation
        // In reality, you'd need to track token holders through events or other mechanisms
        address[] memory holders = new address[](0);
        return holders;
    }

    /**
     * @dev Batch distribute revenue for multiple harvests
     */
    function batchDistributeRevenue(
        string memory _groveName,
        uint256[] memory _harvestIndices
    ) external onlyGroveOwner(_groveName) {
        require(_harvestIndices.length > 0, "No harvest indices provided");
        require(_harvestIndices.length <= 10, "Too many harvests in batch");

        for (uint256 i = 0; i < _harvestIndices.length; i++) {
            this.distributeRevenue(_groveName, _harvestIndices[i]);
        }
    }

    /**
     * @dev Get grove information
     */
    function getGroveInfo(string memory _groveName) 
        external 
        view 
        returns (CoffeeGrove memory) 
    {
        return coffeeGroves[_groveName];
    }

    /**
     * @dev Get harvest history for a grove
     */
    function getGroveHarvests(string memory _groveName) 
        external 
        view 
        returns (HarvestRecord[] memory) 
    {
        return groveHarvests[_groveName];
    }

    /**
     * @dev Get specific harvest record by index
     */
    function getHarvestRecord(string memory _groveName, uint256 _harvestIndex)
        external
        view
        returns (HarvestRecord memory)
    {
        HarvestRecord[] memory harvests = groveHarvests[_groveName];
        require(_harvestIndex < harvests.length, "Invalid harvest index");
        return harvests[_harvestIndex];
    }

    /**
     * @dev Get pending (undistributed) harvests for a grove
     */
    function getPendingHarvests(string memory _groveName)
        external
        view
        returns (HarvestRecord[] memory pendingHarvests, uint256[] memory indices)
    {
        HarvestRecord[] memory allHarvests = groveHarvests[_groveName];
        
        // Count pending harvests
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < allHarvests.length; i++) {
            if (!allHarvests[i].revenueDistributed) {
                pendingCount++;
            }
        }

        // Create arrays for pending harvests
        pendingHarvests = new HarvestRecord[](pendingCount);
        indices = new uint256[](pendingCount);
        
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < allHarvests.length; i++) {
            if (!allHarvests[i].revenueDistributed) {
                pendingHarvests[currentIndex] = allHarvests[i];
                indices[currentIndex] = i;
                currentIndex++;
            }
        }
    }

    /**
     * @dev Get harvest statistics for a grove
     */
    function getGroveHarvestStats(string memory _groveName)
        external
        view
        returns (
            uint256 totalHarvests,
            uint64 totalYieldKg,
            uint64 totalRevenue,
            uint64 averageQuality,
            uint256 pendingDistributions
        )
    {
        HarvestRecord[] memory harvests = groveHarvests[_groveName];
        
        totalHarvests = harvests.length;
        if (totalHarvests == 0) {
            return (0, 0, 0, 0, 0);
        }

        uint64 qualitySum = 0;
        for (uint256 i = 0; i < harvests.length; i++) {
            totalYieldKg += harvests[i].yieldKg;
            totalRevenue += harvests[i].totalRevenue;
            qualitySum += harvests[i].qualityGrade;
            
            if (!harvests[i].revenueDistributed) {
                pendingDistributions++;
            }
        }
        
        averageQuality = qualitySum / uint64(totalHarvests);
    }

    /**
     * @dev Get recent harvests across all groves (for dashboard)
     */
    function getRecentHarvests(uint256 _limit)
        external
        view
        returns (
            string[] memory groveNames,
            HarvestRecord[] memory harvests,
            uint256[] memory harvestIndices
        )
    {
        require(_limit > 0 && _limit <= 100, "Invalid limit");
        
        // This is a simplified implementation
        // In production, you'd want to maintain a global harvest index
        groveNames = new string[](_limit);
        harvests = new HarvestRecord[](_limit);
        harvestIndices = new uint256[](_limit);
        
        uint256 found = 0;
        
        // Iterate through all groves (simplified approach)
        for (uint256 i = 0; i < registeredGroveNames.length && found < _limit; i++) {
            string memory groveName = registeredGroveNames[i];
            HarvestRecord[] memory groveHarvestList = groveHarvests[groveName];
            
            // Get the most recent harvest from this grove
            if (groveHarvestList.length > 0) {
                uint256 lastIndex = groveHarvestList.length - 1;
                groveNames[found] = groveName;
                harvests[found] = groveHarvestList[lastIndex];
                harvestIndices[found] = lastIndex;
                found++;
            }
        }
        
        // Resize arrays to actual found count
        assembly {
            mstore(groveNames, found)
            mstore(harvests, found)
            mstore(harvestIndices, found)
        }
    }

    /**
     * @dev Get all registered grove names
     */
    function getAllGroveNames() external view returns (string[] memory) {
        return registeredGroveNames;
    }

    /**
     * @dev Get token address for a grove
     */
    function getTokenAddress(string memory _groveName) 
        external 
        view 
        returns (address) 
    {
        CoffeeGrove memory grove = coffeeGroves[_groveName];
        if (grove.farmer == address(0)) {
            revert GroveNotFound(_groveName);
        }
        return grove.tokenAddress;
    }

    /**
     * @dev Get manager contract address for a grove
     */
    function getManagerAddress(string memory _groveName) 
        external 
        view 
        returns (address) 
    {
        CoffeeTreeManager manager = groveTokenManagers[_groveName];
        if (address(manager) == address(0)) {
            revert GroveNotFound(_groveName);
        }
        return address(manager);
    }

    /**
     * @dev Get reserve contract address for a grove
     */
    function getReserveAddress(string memory _groveName) 
        external 
        view 
        returns (address) 
    {
        CoffeeGrove memory grove = coffeeGroves[_groveName];
        if (grove.farmer == address(0)) {
            revert GroveNotFound(_groveName);
        }
        CoffeeRevenueReserve reserve = groveReserves[grove.tokenAddress];
        if (address(reserve) == address(0)) {
            return address(0); // Return zero address if no reserve contract exists
        }
        return address(reserve);
    }

    /**
     * @dev Admin function to update farmer verification contract
     */
    function updateFarmerVerification(address _newVerification) external onlyAdmin {
        farmerVerification = FarmerVerification(_newVerification);
    }

    /**
     * @dev Get marketplace listings for a specific grove
     */
    function getGroveMarketplaceListings(string memory _groveName) 
        external 
        view 
        returns (CoffeeTreeMarketplace.TokenListing[] memory) 
    {
        CoffeeGrove memory grove = coffeeGroves[_groveName];
        if (grove.farmer == address(0)) {
            revert GroveNotFound(_groveName);
        }
        if (!grove.isTokenized) {
            revert GroveNotTokenized(_groveName);
        }
        
        return marketplace.getTokenListings(grove.tokenAddress);
    }

    /**
     * @dev Check if marketplace is available for a grove
     */
    function isMarketplaceAvailable(string memory _groveName) external view returns (bool) {
        CoffeeGrove memory grove = coffeeGroves[_groveName];
        return grove.isTokenized && address(marketplace) != address(0);
    }
}