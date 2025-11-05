// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "./system-contracts/hedera-token-service/HederaTokenService.sol";
import "./system-contracts/HederaResponseCodes.sol";
import "./system-contracts/hedera-token-service/IHederaTokenService.sol";
import "./CoffeeTreeIssuer.sol";
import "./interfaces/IERC20.sol";

contract CoffeeTreeMarketplace {
    
    // Listing structure for tree tokens
    struct TokenListing {
        uint256 listingId;
        address seller;
        address tokenAddress;
        string groveName;
        uint64 tokenAmount;
        uint64 pricePerToken;
        uint256 listingDate;
        bool isActive;
        uint256 expirationDate;
    }

    // Trade structure for completed trades
    struct Trade {
        uint256 tradeId;
        uint256 listingId;
        address seller;
        address buyer;
        address tokenAddress;
        string groveName;
        uint64 tokenAmount;
        uint64 pricePerToken;
        uint64 totalPrice;
        uint256 tradeDate;
    }

    // State variables
    address public admin;
    address public USDC;
    CoffeeTreeIssuer public coffeeTreeIssuer;
    IHederaTokenService constant hts = IHederaTokenService(address(0x167));
    
    uint256 public nextListingId = 1;
    uint256 public nextTradeId = 1;
    uint256 public marketplaceFeePercent = 250; // 2.5% fee (250 basis points)
    
    mapping(uint256 => TokenListing) public listings;
    mapping(address => uint256[]) public sellerListings;
    mapping(address => uint256[]) public tokenListings; // listings by token address
    mapping(uint256 => Trade) public trades;
    mapping(address => uint256[]) public userTrades; // trades by user address
    
    uint256[] public activeListingIds;
    uint256[] public completedTradeIds;

    // Events
    event TokenListed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed tokenAddress,
        string groveName,
        uint64 tokenAmount,
        uint64 pricePerToken,
        uint256 expirationDate
    );
    
    event TokenDelisted(
        uint256 indexed listingId,
        address indexed seller,
        string reason
    );
    
    event TokenPurchased(
        uint256 indexed tradeId,
        uint256 indexed listingId,
        address indexed buyer,
        address seller,
        address tokenAddress,
        string groveName,
        uint64 tokenAmount,
        uint64 totalPrice
    );
    
    event ListingUpdated(
        uint256 indexed listingId,
        uint64 newPricePerToken,
        uint256 newExpirationDate
    );

    event MarketplaceFeeUpdated(
        uint256 oldFeePercent,
        uint256 newFeePercent
    );

    // Custom errors
    error ListingNotFound(uint256 listingId);
    error ListingNotActive(uint256 listingId);
    error UnauthorizedSeller(address caller, address seller);
    error InsufficientTokenBalance(uint64 required, uint256 available);
    error InvalidPrice(uint64 price);
    error InvalidAmount(uint64 amount);
    error ListingExpired(uint256 listingId);
    error CannotBuyOwnListing(address buyer);
    error InsufficientPayment(uint64 required, uint64 provided);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    modifier validListing(uint256 _listingId) {
        if (listings[_listingId].listingId == 0) {
            revert ListingNotFound(_listingId);
        }
        if (!listings[_listingId].isActive) {
            revert ListingNotActive(_listingId);
        }
        if (block.timestamp > listings[_listingId].expirationDate) {
            revert ListingExpired(_listingId);
        }
        _;
    }

    constructor(address payable _coffeeTreeIssuer, address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC address");
        admin = msg.sender;
        coffeeTreeIssuer = CoffeeTreeIssuer(_coffeeTreeIssuer);
        USDC = _usdcToken;
    }

    /**
     * @dev List tree tokens for sale on the marketplace
     */
    function listTokensForSale(
        address _tokenAddress,
        string memory _groveName,
        uint64 _tokenAmount,
        uint64 _pricePerToken,
        uint256 _durationDays
    ) external returns (uint256 listingId) {
        // Validate inputs
        if (_tokenAmount == 0) {
            revert InvalidAmount(_tokenAmount);
        }
        if (_pricePerToken == 0) {
            revert InvalidPrice(_pricePerToken);
        }
        require(_durationDays > 0 && _durationDays <= 365, "Duration must be 1-365 days");
        require(bytes(_groveName).length > 0, "Grove name cannot be empty");

        // Check seller has sufficient token balance
        uint256 sellerBalance = IERC20(_tokenAddress).balanceOf(msg.sender);
        if (sellerBalance < _tokenAmount) {
            revert InsufficientTokenBalance(_tokenAmount, sellerBalance);
        }

        // Verify token is from a valid grove
        address groveTokenAddress = coffeeTreeIssuer.getGroveTokenAddress(_groveName);
        require(groveTokenAddress == _tokenAddress, "Invalid token address for grove");

        // Calculate expiration date
        uint256 expirationDate = block.timestamp + (_durationDays * 1 days);

        // Create listing
        listingId = nextListingId++;
        TokenListing storage listing = listings[listingId];
        listing.listingId = listingId;
        listing.seller = msg.sender;
        listing.tokenAddress = _tokenAddress;
        listing.groveName = _groveName;
        listing.tokenAmount = _tokenAmount;
        listing.pricePerToken = _pricePerToken;
        listing.listingDate = block.timestamp;
        listing.isActive = true;
        listing.expirationDate = expirationDate;

        // Update indexes
        sellerListings[msg.sender].push(listingId);
        tokenListings[_tokenAddress].push(listingId);
        activeListingIds.push(listingId);

        // Transfer tokens to marketplace for escrow
        int responseCode = hts.transferFrom(_tokenAddress, msg.sender, address(this), _tokenAmount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer tokens to marketplace");
        }

        emit TokenListed(
            listingId,
            msg.sender,
            _tokenAddress,
            _groveName,
            _tokenAmount,
            _pricePerToken,
            expirationDate
        );

        return listingId;
    }

    /**
     * @dev Purchase tokens from a marketplace listing
     */
    function purchaseTokens(uint256 _listingId) external validListing(_listingId) {
        TokenListing storage listing = listings[_listingId];
        
        // Prevent self-purchase
        if (msg.sender == listing.seller) {
            revert CannotBuyOwnListing(msg.sender);
        }

        uint64 totalPrice = listing.tokenAmount * listing.pricePerToken;
        uint64 marketplaceFee = (totalPrice * uint64(marketplaceFeePercent)) / 10000;
        uint64 sellerAmount = totalPrice - marketplaceFee;

        // Check buyer has sufficient USDC balance
        uint256 buyerBalance = IERC20(USDC).balanceOf(msg.sender);
        if (buyerBalance < totalPrice) {
            revert InsufficientPayment(totalPrice, uint64(buyerBalance));
        }

        // Transfer USDC from buyer to seller (minus marketplace fee)
        int responseCode = hts.transferFrom(USDC, msg.sender, listing.seller, sellerAmount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer USDC to seller");
        }

        // Transfer marketplace fee to admin
        if (marketplaceFee > 0) {
            responseCode = hts.transferFrom(USDC, msg.sender, admin, marketplaceFee);
            if (responseCode != HederaResponseCodes.SUCCESS) {
                revert("Failed to transfer marketplace fee");
            }
        }

        // Transfer tokens from marketplace to buyer
        responseCode = hts.transferFrom(listing.tokenAddress, address(this), msg.sender, listing.tokenAmount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer tokens to buyer");
        }

        // Create trade record
        uint256 tradeId = nextTradeId++;
        Trade storage trade = trades[tradeId];
        trade.tradeId = tradeId;
        trade.listingId = _listingId;
        trade.seller = listing.seller;
        trade.buyer = msg.sender;
        trade.tokenAddress = listing.tokenAddress;
        trade.groveName = listing.groveName;
        trade.tokenAmount = listing.tokenAmount;
        trade.pricePerToken = listing.pricePerToken;
        trade.totalPrice = totalPrice;
        trade.tradeDate = block.timestamp;

        // Update indexes
        userTrades[listing.seller].push(tradeId);
        userTrades[msg.sender].push(tradeId);
        completedTradeIds.push(tradeId);

        // Deactivate listing
        listing.isActive = false;
        _removeFromActiveListings(_listingId);

        emit TokenPurchased(
            tradeId,
            _listingId,
            msg.sender,
            listing.seller,
            listing.tokenAddress,
            listing.groveName,
            listing.tokenAmount,
            totalPrice
        );
    }

    /**
     * @dev Cancel a token listing and return tokens to seller
     */
    function cancelListing(uint256 _listingId) external {
        TokenListing storage listing = listings[_listingId];
        
        if (listing.listingId == 0) {
            revert ListingNotFound(_listingId);
        }
        if (listing.seller != msg.sender) {
            revert UnauthorizedSeller(msg.sender, listing.seller);
        }
        if (!listing.isActive) {
            revert ListingNotActive(_listingId);
        }

        // Return tokens to seller
        int responseCode = hts.transferFrom(listing.tokenAddress, address(this), listing.seller, listing.tokenAmount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to return tokens to seller");
        }

        // Deactivate listing
        listing.isActive = false;
        _removeFromActiveListings(_listingId);

        emit TokenDelisted(_listingId, msg.sender, "Cancelled by seller");
    }

    /**
     * @dev Update listing price and/or expiration
     */
    function updateListing(
        uint256 _listingId,
        uint64 _newPricePerToken,
        uint256 _newDurationDays
    ) external {
        TokenListing storage listing = listings[_listingId];
        
        if (listing.listingId == 0) {
            revert ListingNotFound(_listingId);
        }
        if (listing.seller != msg.sender) {
            revert UnauthorizedSeller(msg.sender, listing.seller);
        }
        if (!listing.isActive) {
            revert ListingNotActive(_listingId);
        }

        // Validate new price
        if (_newPricePerToken == 0) {
            revert InvalidPrice(_newPricePerToken);
        }
        require(_newDurationDays > 0 && _newDurationDays <= 365, "Duration must be 1-365 days");

        // Update listing
        listing.pricePerToken = _newPricePerToken;
        listing.expirationDate = block.timestamp + (_newDurationDays * 1 days);

        emit ListingUpdated(_listingId, _newPricePerToken, listing.expirationDate);
    }

    /**
     * @dev Get active listings for a specific token
     */
    function getTokenListings(address _tokenAddress) external view returns (TokenListing[] memory) {
        uint256[] memory listingIds = tokenListings[_tokenAddress];
        uint256 activeCount = 0;
        
        // Count active listings
        for (uint256 i = 0; i < listingIds.length; i++) {
            TokenListing memory listing = listings[listingIds[i]];
            if (listing.isActive && block.timestamp <= listing.expirationDate) {
                activeCount++;
            }
        }
        
        // Create array of active listings
        TokenListing[] memory activeListings = new TokenListing[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < listingIds.length; i++) {
            TokenListing memory listing = listings[listingIds[i]];
            if (listing.isActive && block.timestamp <= listing.expirationDate) {
                activeListings[currentIndex] = listing;
                currentIndex++;
            }
        }
        
        return activeListings;
    }

    /**
     * @dev Get all active listings with pagination
     */
    function getActiveListings(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (TokenListing[] memory, uint256 totalActive) 
    {
        // Count currently active listings
        uint256 activeCount = 0;
        for (uint256 i = 0; i < activeListingIds.length; i++) {
            TokenListing memory listing = listings[activeListingIds[i]];
            if (listing.isActive && block.timestamp <= listing.expirationDate) {
                activeCount++;
            }
        }
        
        totalActive = activeCount;
        
        // Handle pagination bounds
        if (_offset >= activeCount) {
            return (new TokenListing[](0), totalActive);
        }
        
        uint256 end = _offset + _limit;
        if (end > activeCount) {
            end = activeCount;
        }
        
        uint256 resultLength = end - _offset;
        TokenListing[] memory result = new TokenListing[](resultLength);
        
        // Collect active listings with pagination
        uint256 currentActiveIndex = 0;
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < activeListingIds.length && resultIndex < resultLength; i++) {
            TokenListing memory listing = listings[activeListingIds[i]];
            if (listing.isActive && block.timestamp <= listing.expirationDate) {
                if (currentActiveIndex >= _offset) {
                    result[resultIndex] = listing;
                    resultIndex++;
                }
                currentActiveIndex++;
            }
        }
        
        return (result, totalActive);
    }

    /**
     * @dev Get user's active listings
     */
    function getUserListings(address _user) external view returns (TokenListing[] memory) {
        uint256[] memory userListingIds = sellerListings[_user];
        uint256 activeCount = 0;
        
        // Count active listings
        for (uint256 i = 0; i < userListingIds.length; i++) {
            TokenListing memory listing = listings[userListingIds[i]];
            if (listing.isActive && block.timestamp <= listing.expirationDate) {
                activeCount++;
            }
        }
        
        // Create array of active listings
        TokenListing[] memory activeListings = new TokenListing[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < userListingIds.length; i++) {
            TokenListing memory listing = listings[userListingIds[i]];
            if (listing.isActive && block.timestamp <= listing.expirationDate) {
                activeListings[currentIndex] = listing;
                currentIndex++;
            }
        }
        
        return activeListings;
    }

    /**
     * @dev Get user's trade history
     */
    function getUserTrades(address _user) external view returns (Trade[] memory) {
        uint256[] memory tradeIds = userTrades[_user];
        Trade[] memory userTradeHistory = new Trade[](tradeIds.length);
        
        for (uint256 i = 0; i < tradeIds.length; i++) {
            userTradeHistory[i] = trades[tradeIds[i]];
        }
        
        return userTradeHistory;
    }

    /**
     * @dev Get recent trades with pagination
     */
    function getRecentTrades(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (Trade[] memory, uint256 totalTrades) 
    {
        totalTrades = completedTradeIds.length;
        
        if (_offset >= totalTrades) {
            return (new Trade[](0), totalTrades);
        }
        
        uint256 end = _offset + _limit;
        if (end > totalTrades) {
            end = totalTrades;
        }
        
        uint256 resultLength = end - _offset;
        Trade[] memory result = new Trade[](resultLength);
        
        // Return trades in reverse order (most recent first)
        for (uint256 i = 0; i < resultLength; i++) {
            uint256 tradeIndex = totalTrades - 1 - (_offset + i);
            result[i] = trades[completedTradeIds[tradeIndex]];
        }
        
        return (result, totalTrades);
    }

    /**
     * @dev Get marketplace statistics
     */
    function getMarketplaceStats() 
        external 
        view 
        returns (
            uint256 totalListings,
            uint256 activeListings,
            uint256 totalTrades,
            uint256 totalVolume
        ) 
    {
        totalListings = nextListingId - 1;
        totalTrades = completedTradeIds.length;
        
        // Count active listings
        for (uint256 i = 0; i < activeListingIds.length; i++) {
            TokenListing memory listing = listings[activeListingIds[i]];
            if (listing.isActive && block.timestamp <= listing.expirationDate) {
                activeListings++;
            }
        }
        
        // Calculate total volume
        for (uint256 i = 0; i < completedTradeIds.length; i++) {
            totalVolume += trades[completedTradeIds[i]].totalPrice;
        }
    }

    /**
     * @dev Clean up expired listings (admin function)
     */
    function cleanupExpiredListings(uint256[] memory _listingIds) external onlyAdmin {
        for (uint256 i = 0; i < _listingIds.length; i++) {
            uint256 listingId = _listingIds[i];
            TokenListing storage listing = listings[listingId];
            
            if (listing.isActive && block.timestamp > listing.expirationDate) {
                // Return tokens to seller
                int responseCode = hts.transferFrom(
                    listing.tokenAddress, 
                    address(this), 
                    listing.seller, 
                    listing.tokenAmount
                );
                
                if (responseCode == HederaResponseCodes.SUCCESS) {
                    listing.isActive = false;
                    _removeFromActiveListings(listingId);
                    
                    emit TokenDelisted(listingId, listing.seller, "Expired");
                }
            }
        }
    }

    /**
     * @dev Update marketplace fee (admin function)
     */
    function updateMarketplaceFee(uint256 _newFeePercent) external onlyAdmin {
        require(_newFeePercent <= 1000, "Fee cannot exceed 10%"); // Max 10% fee
        
        uint256 oldFee = marketplaceFeePercent;
        marketplaceFeePercent = _newFeePercent;
        
        emit MarketplaceFeeUpdated(oldFee, _newFeePercent);
    }

    /**
     * @dev Internal function to remove listing from active listings array
     */
    function _removeFromActiveListings(uint256 _listingId) internal {
        for (uint256 i = 0; i < activeListingIds.length; i++) {
            if (activeListingIds[i] == _listingId) {
                // Move last element to current position and pop
                activeListingIds[i] = activeListingIds[activeListingIds.length - 1];
                activeListingIds.pop();
                break;
            }
        }
    }

    /**
     * @dev Get listing details by ID
     */
    function getListing(uint256 _listingId) external view returns (TokenListing memory) {
        return listings[_listingId];
    }

    /**
     * @dev Get trade details by ID
     */
    function getTrade(uint256 _tradeId) external view returns (Trade memory) {
        return trades[_tradeId];
    }

    /**
     * @dev Check if listing is still valid and active
     */
    function isListingActive(uint256 _listingId) external view returns (bool) {
        TokenListing memory listing = listings[_listingId];
        return listing.isActive && block.timestamp <= listing.expirationDate;
    }
}