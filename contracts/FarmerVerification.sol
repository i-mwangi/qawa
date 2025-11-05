// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

/**
 * @title FarmerVerification
 * @dev Smart contract for farmer identity verification and grove ownership validation
 * Implements requirements 5.1, 5.2, 5.3, 5.4 from the coffee tree tokenization spec
 */
contract FarmerVerification {
    
    // Verification status enum
    enum VerificationStatus {
        Pending,
        Verified,
        Rejected
    }
    
    // Farmer verification data structure
    struct FarmerData {
        address farmerAddress;
        string documentsHash;
        string location;
        uint64[] coordinates; // [latitude, longitude] in fixed point format
        VerificationStatus status;
        address verifier;
        uint256 verificationDate;
        string rejectionReason;
        uint256 submissionDate;
    }
    
    // Grove ownership data structure
    struct GroveOwnership {
        address farmer;
        string groveName;
        string ownershipProofHash;
        bool isRegistered;
        uint256 registrationDate;
    }
    
    // State variables
    address public admin;
    mapping(address => bool) public authorizedVerifiers;
    mapping(address => FarmerData) public farmers;
    mapping(string => GroveOwnership) public groveOwnerships;
    mapping(address => string[]) public farmerGroves; // farmer address -> grove names
    
    // Events
    event DocumentsSubmitted(
        address indexed farmer,
        string documentsHash,
        string location,
        uint256 timestamp
    );
    
    event FarmerVerified(
        address indexed farmer,
        address indexed verifier,
        VerificationStatus status,
        uint256 timestamp
    );
    
    event FarmerRejected(
        address indexed farmer,
        address indexed verifier,
        string reason,
        uint256 timestamp
    );
    
    event GroveOwnershipRegistered(
        address indexed farmer,
        string indexed groveName,
        string ownershipProofHash,
        uint256 timestamp
    );
    
    event VerifierAdded(address indexed verifier, address indexed admin);
    event VerifierRemoved(address indexed verifier, address indexed admin);
    
    // Custom errors
    error UnauthorizedAccess(address caller);
    error FarmerNotFound(address farmer);
    error FarmerAlreadyVerified(address farmer);
    error InvalidDocuments(string reason);
    error GroveAlreadyRegistered(string groveName);
    error GroveNotFound(string groveName);
    error InvalidCoordinates();
    error EmptyString(string paramName);
    
    // Modifiers
    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert UnauthorizedAccess(msg.sender);
        }
        _;
    }
    
    modifier onlyVerifier() {
        if (!authorizedVerifiers[msg.sender] && msg.sender != admin) {
            revert UnauthorizedAccess(msg.sender);
        }
        _;
    }
    
    modifier onlyVerifiedFarmer() {
        if (farmers[msg.sender].status != VerificationStatus.Verified) {
            revert UnauthorizedAccess(msg.sender);
        }
        _;
    }
    
    modifier validString(string memory str, string memory paramName) {
        if (bytes(str).length == 0) {
            revert EmptyString(paramName);
        }
        _;
    }
    
    constructor() {
        admin = msg.sender;
        authorizedVerifiers[msg.sender] = true; // Admin is also a verifier
    }
    
    /**
     * @dev Add an authorized verifier
     * @param verifier Address of the verifier to add
     */
    function addVerifier(address verifier) external onlyAdmin {
        require(verifier != address(0), "Invalid verifier address");
        authorizedVerifiers[verifier] = true;
        emit VerifierAdded(verifier, msg.sender);
    }
    
    /**
     * @dev Remove an authorized verifier
     * @param verifier Address of the verifier to remove
     */
    function removeVerifier(address verifier) external onlyAdmin {
        require(verifier != admin, "Cannot remove admin as verifier");
        authorizedVerifiers[verifier] = false;
        emit VerifierRemoved(verifier, msg.sender);
    }
    
    /**
     * @dev Submit verification documents for farmer identity verification
     * @param documentsHash IPFS hash or similar identifier for uploaded documents
     * @param location Human-readable location description
     * @param coordinates Array containing [latitude, longitude] in fixed point format
     */
    function submitVerificationDocuments(
        string memory documentsHash,
        string memory location,
        uint64[] memory coordinates
    ) external 
        validString(documentsHash, "documentsHash")
        validString(location, "location")
    {
        // Validate coordinates array
        if (coordinates.length != 2) {
            revert InvalidCoordinates();
        }
        
        // Check if farmer already has a submission
        FarmerData storage farmer = farmers[msg.sender];
        if (farmer.status == VerificationStatus.Verified) {
            revert FarmerAlreadyVerified(msg.sender);
        }
        
        // Store farmer verification data
        farmer.farmerAddress = msg.sender;
        farmer.documentsHash = documentsHash;
        farmer.location = location;
        farmer.coordinates = coordinates;
        farmer.status = VerificationStatus.Pending;
        farmer.submissionDate = block.timestamp;
        
        // Clear previous rejection data if resubmitting
        if (bytes(farmer.rejectionReason).length > 0) {
            farmer.rejectionReason = "";
            farmer.verifier = address(0);
            farmer.verificationDate = 0;
        }
        
        emit DocumentsSubmitted(msg.sender, documentsHash, location, block.timestamp);
    }
    
    /**
     * @dev Verify or reject a farmer's application
     * @param farmer Address of the farmer to verify
     * @param approved Whether the farmer is approved or rejected
     * @param rejectionReason Reason for rejection (empty if approved)
     */
    function verifyFarmer(
        address farmer,
        bool approved,
        string memory rejectionReason
    ) external onlyVerifier {
        FarmerData storage farmerData = farmers[farmer];
        
        // Check if farmer has submitted documents
        if (farmerData.farmerAddress == address(0)) {
            revert FarmerNotFound(farmer);
        }
        
        // Check if farmer is already verified
        if (farmerData.status == VerificationStatus.Verified) {
            revert FarmerAlreadyVerified(farmer);
        }
        
        // Update verification status
        farmerData.verifier = msg.sender;
        farmerData.verificationDate = block.timestamp;
        
        if (approved) {
            farmerData.status = VerificationStatus.Verified;
            farmerData.rejectionReason = ""; // Clear any previous rejection reason
            emit FarmerVerified(farmer, msg.sender, VerificationStatus.Verified, block.timestamp);
        } else {
            if (bytes(rejectionReason).length == 0) {
                revert EmptyString("rejectionReason");
            }
            farmerData.status = VerificationStatus.Rejected;
            farmerData.rejectionReason = rejectionReason;
            emit FarmerRejected(farmer, msg.sender, rejectionReason, block.timestamp);
        }
    }
    
    /**
     * @dev Register grove ownership for a verified farmer
     * @param farmer Address of the verified farmer
     * @param groveName Unique name for the grove
     * @param ownershipProofHash Hash of ownership documentation
     */
    function registerGroveOwnership(
        address farmer,
        string memory groveName,
        string memory ownershipProofHash
    ) external 
        onlyVerifier
        validString(groveName, "groveName")
        validString(ownershipProofHash, "ownershipProofHash")
    {
        // Check if farmer is verified
        if (farmers[farmer].status != VerificationStatus.Verified) {
            revert UnauthorizedAccess(farmer);
        }
        
        // Check if grove name is already registered
        if (groveOwnerships[groveName].isRegistered) {
            revert GroveAlreadyRegistered(groveName);
        }
        
        // Register grove ownership
        groveOwnerships[groveName] = GroveOwnership({
            farmer: farmer,
            groveName: groveName,
            ownershipProofHash: ownershipProofHash,
            isRegistered: true,
            registrationDate: block.timestamp
        });
        
        // Add grove to farmer's grove list
        farmerGroves[farmer].push(groveName);
        
        emit GroveOwnershipRegistered(farmer, groveName, ownershipProofHash, block.timestamp);
    }
    
    /**
     * @dev Check if a farmer is verified
     * @param farmer Address of the farmer to check
     * @return bool True if farmer is verified, false otherwise
     */
    function isVerifiedFarmer(address farmer) external view returns (bool) {
        return farmers[farmer].status == VerificationStatus.Verified;
    }
    
    /**
     * @dev Get farmer verification data
     * @param farmer Address of the farmer
     * @return FarmerData struct containing all farmer verification information
     */
    function getFarmerData(address farmer) external view returns (FarmerData memory) {
        return farmers[farmer];
    }
    
    /**
     * @dev Get grove ownership information
     * @param groveName Name of the grove
     * @return GroveOwnership struct containing grove ownership information
     */
    function getGroveOwnership(string memory groveName) external view returns (GroveOwnership memory) {
        return groveOwnerships[groveName];
    }
    
    /**
     * @dev Check if a grove is owned by a specific farmer
     * @param groveName Name of the grove
     * @param farmer Address of the farmer
     * @return bool True if the farmer owns the grove, false otherwise
     */
    function isGroveOwner(string memory groveName, address farmer) external view returns (bool) {
        GroveOwnership memory grove = groveOwnerships[groveName];
        return grove.isRegistered && grove.farmer == farmer;
    }
    
    /**
     * @dev Get all groves owned by a farmer
     * @param farmer Address of the farmer
     * @return string[] Array of grove names owned by the farmer
     */
    function getFarmerGroves(address farmer) external view returns (string[] memory) {
        return farmerGroves[farmer];
    }
    
    /**
     * @dev Get verification status of a farmer
     * @param farmer Address of the farmer
     * @return VerificationStatus Current verification status
     */
    function getVerificationStatus(address farmer) external view returns (VerificationStatus) {
        return farmers[farmer].status;
    }
    
    /**
     * @dev Check if an address is an authorized verifier
     * @param verifier Address to check
     * @return bool True if authorized verifier, false otherwise
     */
    function isAuthorizedVerifier(address verifier) external view returns (bool) {
        return authorizedVerifiers[verifier];
    }
}