// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

contract CoffeePriceOracle {
    address public admin;
    uint64 public denominator = 1000000;
    
    // Coffee variety types
    enum CoffeeVariety { ARABICA, ROBUSTA, SPECIALTY, ORGANIC }
    
    // Coffee quality grades (1-10, where 10 is highest quality)
    struct CoffeeGrade {
        uint8 grade;
        string description;
    }
    
    // Price data structure for coffee varieties
    struct CoffeePrice {
        uint64 basePrice;        // Price per kg in USDC (scaled by denominator)
        uint64 lastUpdated;      // Timestamp of last price update
        bool isActive;           // Whether this variety is actively traded
    }
    
    // Seasonal multipliers for different months (scaled by 1000, so 1200 = 1.2x)
    struct SeasonalMultiplier {
        uint64 multiplier;       // Seasonal price multiplier
        bool isSet;              // Whether multiplier has been set
    }
    
    // Events
    event CoffeePriceUpdate(CoffeeVariety indexed variety, uint8 indexed grade, uint64 indexed price);
    event SeasonalMultiplierUpdate(uint8 indexed month, uint64 indexed multiplier);
    event ProjectedRevenueCalculated(address indexed groveToken, uint64 indexed projectedRevenue);
    
    // Storage mappings
    mapping(CoffeeVariety => mapping(uint8 => CoffeePrice)) public coffeePrices;
    mapping(uint8 => SeasonalMultiplier) public seasonalMultipliers; // month (1-12) => multiplier
    mapping(address => uint64) public tokenPrices; // Backward compatibility with existing system
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }
    
    modifier validGrade(uint8 grade) {
        require(grade >= 1 && grade <= 10, "Grade must be between 1 and 10");
        _;
    }
    
    modifier validMonth(uint8 month) {
        require(month >= 1 && month <= 12, "Month must be between 1 and 12");
        _;
    }
    
    constructor() {
        admin = msg.sender;
        _initializeDefaultMultipliers();
    }
    
    /**
     * @dev Initialize default seasonal multipliers (neutral 1.0x for all months)
     */
    function _initializeDefaultMultipliers() private {
        for (uint8 i = 1; i <= 12; i++) {
            seasonalMultipliers[i] = SeasonalMultiplier({
                multiplier: 1000, // 1.0x multiplier
                isSet: true
            });
        }
    }
    
    /**
     * @dev Update coffee price for a specific variety and grade
     * @param variety Coffee variety (Arabica, Robusta, etc.)
     * @param grade Quality grade (1-10)
     * @param price Price per kg in USDC (scaled by denominator)
     */
    function updateCoffeePrice(
        CoffeeVariety variety,
        uint8 grade,
        uint64 price
    ) external onlyAdmin validGrade(grade) {
        coffeePrices[variety][grade] = CoffeePrice({
            basePrice: price,
            lastUpdated: uint64(block.timestamp),
            isActive: true
        });
        
        emit CoffeePriceUpdate(variety, grade, price);
    }
    
    /**
     * @dev Get current coffee price for variety and grade
     * @param variety Coffee variety
     * @param grade Quality grade
     * @return Current price per kg in USDC
     */
    function getCoffeePrice(
        CoffeeVariety variety,
        uint8 grade
    ) external view validGrade(grade) returns (uint64) {
        CoffeePrice memory priceData = coffeePrices[variety][grade];
        require(priceData.isActive, "Price not available for this variety/grade");
        return priceData.basePrice;
    }
    
    /**
     * @dev Get coffee price with seasonal adjustment
     * @param variety Coffee variety
     * @param grade Quality grade
     * @param month Month for seasonal adjustment (1-12)
     * @return Seasonally adjusted price per kg
     */
    function getSeasonalCoffeePrice(
        CoffeeVariety variety,
        uint8 grade,
        uint8 month
    ) external view validGrade(grade) validMonth(month) returns (uint64) {
        CoffeePrice memory priceData = coffeePrices[variety][grade];
        require(priceData.isActive, "Price not available for this variety/grade");
        
        SeasonalMultiplier memory seasonal = seasonalMultipliers[month];
        require(seasonal.isSet, "Seasonal multiplier not set for this month");
        
        // Apply seasonal multiplier (multiplier is scaled by 1000)
        return (priceData.basePrice * seasonal.multiplier) / 1000;
    }
    
    /**
     * @dev Update seasonal multiplier for a specific month
     * @param month Month (1-12)
     * @param multiplier Seasonal multiplier (scaled by 1000, e.g., 1200 = 1.2x)
     */
    function updateSeasonalMultiplier(
        uint8 month,
        uint64 multiplier
    ) external onlyAdmin validMonth(month) {
        require(multiplier > 0, "Multiplier must be greater than 0");
        
        seasonalMultipliers[month] = SeasonalMultiplier({
            multiplier: multiplier,
            isSet: true
        });
        
        emit SeasonalMultiplierUpdate(month, multiplier);
    }
    
    /**
     * @dev Calculate projected revenue for a coffee grove based on expected yield
     * @param groveToken Address of the grove token contract
     * @param variety Coffee variety grown in the grove
     * @param grade Expected quality grade
     * @param expectedYieldKg Expected yield in kilograms
     * @param harvestMonth Expected harvest month for seasonal pricing
     * @return Projected revenue in USDC
     */
    function calculateProjectedRevenue(
        address groveToken,
        CoffeeVariety variety,
        uint8 grade,
        uint64 expectedYieldKg,
        uint8 harvestMonth
    ) external view validGrade(grade) validMonth(harvestMonth) returns (uint64) {
        require(groveToken != address(0), "Invalid grove token address");
        require(expectedYieldKg > 0, "Expected yield must be greater than 0");
        
        // Get seasonal price
        uint64 pricePerKg = this.getSeasonalCoffeePrice(variety, grade, harvestMonth);
        
        // Calculate total projected revenue
        uint64 projectedRevenue = (expectedYieldKg * pricePerKg) / denominator;
        
        return projectedRevenue;
    }
    
    /**
     * @dev Batch update multiple coffee prices
     * @param varieties Array of coffee varieties
     * @param grades Array of quality grades
     * @param prices Array of prices
     */
    function batchUpdateCoffeePrices(
        CoffeeVariety[] calldata varieties,
        uint8[] calldata grades,
        uint64[] calldata prices
    ) external onlyAdmin {
        require(
            varieties.length == grades.length && grades.length == prices.length,
            "Array lengths must match"
        );
        
        for (uint256 i = 0; i < varieties.length; i++) {
            require(grades[i] >= 1 && grades[i] <= 10, "Invalid grade");
            
            coffeePrices[varieties[i]][grades[i]] = CoffeePrice({
                basePrice: prices[i],
                lastUpdated: uint64(block.timestamp),
                isActive: true
            });
            
            emit CoffeePriceUpdate(varieties[i], grades[i], prices[i]);
        }
    }
    
    /**
     * @dev Get price data including last updated timestamp
     * @param variety Coffee variety
     * @param grade Quality grade
     * @return price Current price
     * @return lastUpdated Timestamp of last update
     * @return isActive Whether price is active
     */
    function getCoffeePriceData(
        CoffeeVariety variety,
        uint8 grade
    ) external view validGrade(grade) returns (uint64 price, uint64 lastUpdated, bool isActive) {
        CoffeePrice memory priceData = coffeePrices[variety][grade];
        return (priceData.basePrice, priceData.lastUpdated, priceData.isActive);
    }
    
    /**
     * @dev Deactivate a coffee variety/grade price (stop trading)
     * @param variety Coffee variety
     * @param grade Quality grade
     */
    function deactivateCoffeePrice(
        CoffeeVariety variety,
        uint8 grade
    ) external onlyAdmin validGrade(grade) {
        coffeePrices[variety][grade].isActive = false;
    }
    
    // Backward compatibility functions for existing system
    
    /**
     * @dev Update price for backward compatibility with existing token system
     * @param tokenId Token address
     * @param price Price in USDC
     */
    function updatePrice(address tokenId, uint64 price) external onlyAdmin {
        tokenPrices[tokenId] = price;
        emit PriceUpdate(tokenId, price);
    }
    
    /**
     * @dev Get price for backward compatibility
     * @param tokenId Token address
     * @return Price in USDC
     */
    function getPrice(address tokenId) external view returns (uint64) {
        return tokenPrices[tokenId];
    }
    
    // Legacy event for backward compatibility
    event PriceUpdate(address indexed tokenId, uint64 indexed price);
}