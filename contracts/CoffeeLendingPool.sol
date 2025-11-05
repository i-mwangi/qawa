// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "./system-contracts/hedera-token-service/HederaTokenService.sol";
import "./system-contracts/HederaResponseCodes.sol";
import "./system-contracts/hedera-token-service/IHederaTokenService.sol";
import "./system-contracts/hedera-token-service/KeyHelper.sol";
import "./system-contracts/hedera-token-service/ExpiryHelper.sol";
import "./system-contracts/hedera-token-service/IHRC719.sol";
import "./@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IERC20.sol";

contract CoffeeLendingPool is HederaTokenService, KeyHelper, ExpiryHelper {
    
    address public admin;
    address public USDC;
    address public coffeeTreeToken;
    address public lpToken;
    
    IHederaTokenService constant hts = IHederaTokenService(address(0x167));
    
    uint256 public totalLiquidity;
    uint256 public availableLiquidity;
    uint256 public totalBorrowed;
    uint256 public baseAPY = 850; // 8.5% (in basis points)
    
    uint256 public constant COLLATERALIZATION_RATIO = 125; // 125%
    uint256 public constant LIQUIDATION_THRESHOLD = 90; // 90%
    uint256 public constant INTEREST_RATE = 10; // 10%
    
    struct Loan {
        address borrower;
        uint64 loanAmountUSDC;
        uint64 collateralAmount;
        uint64 liquidationPrice;
        uint64 repayAmountUSDC;
        uint256 borrowDate;
        bool isActive;
        bool isLiquidated;
    }
    
    struct LiquidityPosition {
        address provider;
        uint256 amountProvided;
        uint256 lpTokensReceived;
        uint256 depositDate;
        uint256 accruedInterest;
    }
    
    mapping(address => Loan) public loans;
    mapping(address => LiquidityPosition) public liquidityPositions;
    mapping(address => uint256) public lpTokenBalances;
    
    address[] public liquidityProviders;
    address[] public activeBorrowers;
    
    event LiquidityProvided(
        address indexed provider,
        uint256 amount,
        uint256 lpTokensReceived,
        uint256 timestamp
    );
    
    event LiquidityWithdrawn(
        address indexed provider,
        uint256 amount,
        uint256 lpTokensBurned,
        uint256 interestEarned,
        uint256 timestamp
    );
    
    event LoanTaken(
        address indexed borrower,
        uint64 loanAmount,
        uint64 collateralAmount,
        uint64 repayAmount,
        uint256 timestamp
    );
    
    event LoanRepaid(
        address indexed borrower,
        uint64 repayAmount,
        uint256 timestamp
    );
    
    event LoanLiquidated(
        address indexed borrower,
        uint64 collateralSeized,
        uint256 timestamp
    );
    
    event PoolStatsUpdated(
        uint256 totalLiquidity,
        uint256 availableLiquidity,
        uint256 totalBorrowed,
        uint256 utilizationRate,
        uint256 timestamp
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    receive() external payable {}
    fallback() external payable {}

    constructor(address _usdcToken, address _coffeeTreeToken) {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_coffeeTreeToken != address(0), "Invalid coffee tree token address");
        
        admin = msg.sender;
        USDC = _usdcToken;
        coffeeTreeToken = _coffeeTreeToken;
        
        uint256 associateResponse = IHRC719(USDC).associate();
        if (int32(uint32(associateResponse)) != HederaResponseCodes.SUCCESS) {
            revert("Failed to associate USDC");
        }
        
        associateResponse = IHRC719(coffeeTreeToken).associate();
        if (int32(uint32(associateResponse)) != HederaResponseCodes.SUCCESS) {
            revert("Failed to associate coffee tree token");
        }
    }

    function createLPToken(string memory name, string memory symbol) external payable onlyAdmin {
        require(lpToken == address(0), "LP token already created");
        
        IHederaTokenService.HederaToken memory tokenDetails;
        tokenDetails.name = name;
        tokenDetails.symbol = symbol;
        tokenDetails.treasury = address(this);
        tokenDetails.expiry = createAutoRenewExpiry(address(this), 7890000);
        
        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](4);
        keys[0] = getSingleKey(KeyType.ADMIN, KeyValueType.CONTRACT_ID, address(this));
        keys[1] = getSingleKey(KeyType.SUPPLY, KeyValueType.CONTRACT_ID, address(this));
        keys[2] = getSingleKey(KeyType.WIPE, KeyValueType.CONTRACT_ID, address(this));
        keys[3] = getSingleKey(KeyType.PAUSE, KeyValueType.CONTRACT_ID, address(this));
        
        tokenDetails.tokenKeys = keys;
        
        (int response, address tokenAddress) = createFungibleToken(tokenDetails, 0, 6);
        
        if (response != HederaResponseCodes.SUCCESS) {
            revert("Failed to create LP token");
        }
        
        lpToken = tokenAddress;
    }

    function provideLiquidity(uint64 amount) external {
        require(lpToken != address(0), "LP token not created");
        require(amount > 0, "Amount must be positive");
        
        int responseCode = hts.transferFrom(USDC, msg.sender, address(this), uint256(amount));
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer USDC");
        }
        
        uint256 lpTokensToMint = amount;
        if (totalLiquidity > 0) {
            lpTokensToMint = (uint256(amount) * IERC20(lpToken).totalSupply()) / totalLiquidity;
        }
        
        (int mintResponse, , ) = HederaTokenService.mintToken(lpToken, int64(uint64(lpTokensToMint)), new bytes[](0));
        if (mintResponse != HederaResponseCodes.SUCCESS) {
            revert("Failed to mint LP tokens");
        }
        
        IHederaTokenService.AccountAmount memory recipientAccount;
        recipientAccount.accountID = msg.sender;
        recipientAccount.amount = int64(uint64(lpTokensToMint));
        
        IHederaTokenService.AccountAmount memory senderAccount;
        senderAccount.accountID = address(this);
        senderAccount.amount = -int64(uint64(lpTokensToMint));
        
        IHederaTokenService.TokenTransferList memory tokenTransferList;
        tokenTransferList.token = lpToken;
        tokenTransferList.transfers = new IHederaTokenService.AccountAmount[](2);
        tokenTransferList.transfers[0] = senderAccount;
        tokenTransferList.transfers[1] = recipientAccount;
        
        IHederaTokenService.TokenTransferList[] memory transferList = new IHederaTokenService.TokenTransferList[](1);
        transferList[0] = tokenTransferList;
        
        IHederaTokenService.TransferList memory hbarTransferList;
        responseCode = HederaTokenService.cryptoTransfer(hbarTransferList, transferList);
        
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer LP tokens");
        }
        
        if (liquidityPositions[msg.sender].provider == address(0)) {
            liquidityProviders.push(msg.sender);
        }
        
        liquidityPositions[msg.sender].provider = msg.sender;
        liquidityPositions[msg.sender].amountProvided += amount;
        liquidityPositions[msg.sender].lpTokensReceived += lpTokensToMint;
        liquidityPositions[msg.sender].depositDate = block.timestamp;
        
        lpTokenBalances[msg.sender] += lpTokensToMint;
        totalLiquidity += amount;
        availableLiquidity += amount;
        
        emit LiquidityProvided(msg.sender, amount, lpTokensToMint, block.timestamp);
        _updatePoolStats();
    }

    function withdrawLiquidity(uint64 lpTokenAmount) external {
        require(lpTokenAmount > 0, "Amount must be positive");
        require(lpTokenBalances[msg.sender] >= lpTokenAmount, "Insufficient LP tokens");
        
        uint256 lpTotalSupply = IERC20(lpToken).totalSupply();
        uint256 usdcAmount = (uint256(lpTokenAmount) * totalLiquidity) / lpTotalSupply;
        
        require(usdcAmount <= availableLiquidity, "Insufficient liquidity available");
        
        int responseCode = hts.transferFrom(lpToken, msg.sender, address(this), uint256(lpTokenAmount));
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer LP tokens");
        }
        
        (int burnResponse, ) = HederaTokenService.burnToken(lpToken, int64(lpTokenAmount), new int64[](0));
        if (burnResponse != HederaResponseCodes.SUCCESS) {
            revert("Failed to burn LP tokens");
        }
        
        grantAllowanceToSelf(usdcAmount);
        responseCode = hts.transferFrom(USDC, address(this), msg.sender, usdcAmount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer USDC");
        }
        
        uint256 interest = liquidityPositions[msg.sender].accruedInterest;
        
        liquidityPositions[msg.sender].amountProvided -= usdcAmount;
        liquidityPositions[msg.sender].lpTokensReceived -= lpTokenAmount;
        liquidityPositions[msg.sender].accruedInterest = 0;
        
        lpTokenBalances[msg.sender] -= lpTokenAmount;
        totalLiquidity -= usdcAmount;
        availableLiquidity -= usdcAmount;
        
        emit LiquidityWithdrawn(msg.sender, usdcAmount, lpTokenAmount, interest, block.timestamp);
        _updatePoolStats();
    }

    function takeLoan(uint64 collateralAmount, uint64 loanAmount) external {
        require(collateralAmount > 0, "Collateral must be positive");
        require(loanAmount > 0, "Loan amount must be positive");
        require(!loans[msg.sender].isActive, "Existing loan must be repaid first");
        require(loanAmount <= availableLiquidity, "Insufficient pool liquidity");
        
        uint256 collateralValue = uint256(collateralAmount);
        uint256 requiredCollateral = (uint256(loanAmount) * COLLATERALIZATION_RATIO) / 100;
        require(collateralValue >= requiredCollateral, "Insufficient collateral");
        
        int responseCode = hts.transferFrom(coffeeTreeToken, msg.sender, address(this), uint256(collateralAmount));
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer collateral");
        }
        
        uint64 liquidationPrice = uint64((uint256(loanAmount) * LIQUIDATION_THRESHOLD) / 100);
        uint64 repayAmount = uint64((uint256(loanAmount) * (100 + INTEREST_RATE)) / 100);
        
        loans[msg.sender] = Loan({
            borrower: msg.sender,
            loanAmountUSDC: loanAmount,
            collateralAmount: collateralAmount,
            liquidationPrice: liquidationPrice,
            repayAmountUSDC: repayAmount,
            borrowDate: block.timestamp,
            isActive: true,
            isLiquidated: false
        });
        
        activeBorrowers.push(msg.sender);
        
        grantAllowanceToSelf(loanAmount);
        responseCode = hts.transferFrom(USDC, address(this), msg.sender, uint256(loanAmount));
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer loan amount");
        }
        
        availableLiquidity -= loanAmount;
        totalBorrowed += loanAmount;
        
        emit LoanTaken(msg.sender, loanAmount, collateralAmount, repayAmount, block.timestamp);
        _updatePoolStats();
    }

    function repayLoan() external {
        Loan storage loan = loans[msg.sender];
        require(loan.isActive, "No active loan");
        require(!loan.isLiquidated, "Loan already liquidated");
        
        int responseCode = hts.transferFrom(USDC, msg.sender, address(this), uint256(loan.repayAmountUSDC));
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to transfer repayment");
        }
        
        grantAllowanceToSelf(loan.collateralAmount);
        responseCode = hts.transferFrom(coffeeTreeToken, address(this), msg.sender, uint256(loan.collateralAmount));
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to return collateral");
        }
        
        uint64 interest = loan.repayAmountUSDC - loan.loanAmountUSDC;
        
        availableLiquidity += loan.repayAmountUSDC;
        totalBorrowed -= loan.loanAmountUSDC;
        
        emit LoanRepaid(msg.sender, loan.repayAmountUSDC, block.timestamp);
        
        loan.isActive = false;
        
        _distributeInterestToProviders(interest);
        _updatePoolStats();
    }

    function liquidateLoan(address borrower) external onlyAdmin {
        Loan storage loan = loans[borrower];
        require(loan.isActive, "No active loan");
        require(!loan.isLiquidated, "Already liquidated");
        
        loan.isActive = false;
        loan.isLiquidated = true;
        
        emit LoanLiquidated(borrower, loan.collateralAmount, block.timestamp);
        _updatePoolStats();
    }

    function _distributeInterestToProviders(uint64 interestAmount) internal {
        if (liquidityProviders.length == 0 || totalLiquidity == 0) {
            return;
        }
        
        for (uint256 i = 0; i < liquidityProviders.length; i++) {
            address provider = liquidityProviders[i];
            LiquidityPosition storage position = liquidityPositions[provider];
            
            if (position.amountProvided > 0) {
                uint256 share = (position.amountProvided * uint256(interestAmount)) / totalLiquidity;
                position.accruedInterest += share;
            }
        }
    }

    function grantAllowanceToSelf(uint256 amount) private {
        int64 responseCode = hts.approve(USDC, address(this), amount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Failed to grant allowance");
        }
    }

    function _updatePoolStats() internal {
        uint256 utilizationRate = totalLiquidity > 0 
            ? (totalBorrowed * 10000) / totalLiquidity 
            : 0;
        
        emit PoolStatsUpdated(
            totalLiquidity,
            availableLiquidity,
            totalBorrowed,
            utilizationRate,
            block.timestamp
        );
    }

    function getPoolStats() external view returns (
        uint256 _totalLiquidity,
        uint256 _availableLiquidity,
        uint256 _totalBorrowed,
        uint256 _utilizationRate,
        uint256 _currentAPY
    ) {
        uint256 utilizationRate = totalLiquidity > 0 
            ? (totalBorrowed * 10000) / totalLiquidity 
            : 0;
        
        return (
            totalLiquidity,
            availableLiquidity,
            totalBorrowed,
            utilizationRate,
            baseAPY
        );
    }

    function getLoan(address borrower) external view returns (
        uint64 loanAmount,
        uint64 collateralAmount,
        uint64 repayAmount,
        uint256 borrowDate,
        bool isActive,
        bool isLiquidated
    ) {
        Loan memory loan = loans[borrower];
        return (
            loan.loanAmountUSDC,
            loan.collateralAmount,
            loan.repayAmountUSDC,
            loan.borrowDate,
            loan.isActive,
            loan.isLiquidated
        );
    }

    function getLiquidityPosition(address provider) external view returns (
        uint256 amountProvided,
        uint256 lpTokensReceived,
        uint256 depositDate,
        uint256 accruedInterest
    ) {
        LiquidityPosition memory position = liquidityPositions[provider];
        return (
            position.amountProvided,
            position.lpTokensReceived,
            position.depositDate,
            position.accruedInterest
        );
    }

    function updateAPY(uint256 newAPY) external onlyAdmin {
        require(newAPY <= 10000, "APY cannot exceed 100%");
        baseAPY = newAPY;
    }

    function getLPToken() external view returns (address) {
        return lpToken;
    }
}
