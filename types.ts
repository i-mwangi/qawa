

type SHARED_KEYS = {
    FILE_ID: string | null
    CONTRACT_ID: string | null
    USDC_TOKEN_ID: string | null
}

// Coffee Tree specific interfaces
export interface CoffeeGrove {
    id: number;
    groveName: string;
    farmerAddress: string;
    tokenAddress?: string;
    location: string;
    coordinates: {
        lat: number;
        lng: number;
    };
    treeCount: number;
    coffeeVariety: string;
    plantingDate: Date;
    expectedYieldPerTree: number;
    totalTokensIssued: number;
    tokensPerTree: number;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    currentHealthScore?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface HarvestRecord {
    id: number;
    groveId: number;
    harvestDate: Date;
    yieldKg: number;
    qualityGrade: number;
    salePricePerKg: number;
    totalRevenue: number;
    farmerShare: number;
    investorShare: number;
    revenueDistributed: boolean;
    transactionHash?: string;
    createdAt: Date;
}

export interface TokenHolding {
    id: number;
    holderAddress: string;
    groveId: number;
    tokenAmount: number;
    purchasePrice: number;
    purchaseDate: Date;
    isActive: boolean;
    currentValue?: number;
    projectedAnnualReturn?: number;
}

export interface RevenueDistribution {
    id: number;
    harvestId: number;
    holderAddress: string;
    tokenAmount: number;
    revenueShare: number;
    distributionDate: Date;
    transactionHash: string;
}

export interface FarmerVerification {
    id: number;
    farmerAddress: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    documentsHash?: string;
    verifierAddress?: string;
    verificationDate?: Date;
    rejectionReason?: string;
    createdAt: Date;
}

// Database row types (matching the schema exactly)
export interface CoffeeGroveRow {
    id: number;
    groveName: string;
    farmerAddress: string;
    tokenAddress: string | null;
    location: string;
    coordinatesLat: number | null;
    coordinatesLng: number | null;
    treeCount: number;
    coffeeVariety: string;
    plantingDate: number | null;
    expectedYieldPerTree: number | null;
    totalTokensIssued: number | null;
    tokensPerTree: number | null;
    verificationStatus: string | null;
    currentHealthScore: number | null;
    createdAt: number | null;
    updatedAt: number | null;
}

export interface HarvestRecordRow {
    id: number;
    groveId: number;
    harvestDate: number;
    yieldKg: number;
    qualityGrade: number;
    salePricePerKg: number;
    totalRevenue: number;
    farmerShare: number;
    investorShare: number;
    revenueDistributed: boolean;
    transactionHash: string | null;
    createdAt: number | null;
}

export interface TokenHoldingRow {
    id: number;
    holderAddress: string;
    groveId: number;
    tokenAmount: number;
    purchasePrice: number;
    purchaseDate: number;
    isActive: boolean;
}

// Tree Monitoring System Interfaces
export interface IoTSensorData {
    id: number;
    groveId: number;
    sensorId: string;
    sensorType: 'soil_moisture' | 'temperature' | 'humidity' | 'ph' | 'light' | 'rainfall';
    value: number;
    unit: string;
    location?: {
        lat: number;
        lng: number;
    };
    timestamp: Date;
    createdAt: Date;
}

export interface TreeHealthRecord {
    id: number;
    groveId: number;
    healthScore: number; // 0-100
    assessmentDate: Date;
    soilMoistureScore?: number;
    temperatureScore?: number;
    humidityScore?: number;
    phScore?: number;
    lightScore?: number;
    rainfallScore?: number;
    riskFactors: string[]; // Array of risk identifiers
    recommendations: string[]; // Array of care recommendations
    yieldImpactProjection?: number; // -1.0 to 1.0
    createdAt: Date;
}

export interface EnvironmentalAlert {
    id: number;
    groveId: number;
    alertType: 'DROUGHT_RISK' | 'TEMPERATURE_EXTREME' | 'DISEASE_RISK' | 'PEST_RISK' | 'NUTRIENT_DEFICIENCY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    message: string;
    sensorDataId?: number;
    healthRecordId?: number;
    farmerNotified: boolean;
    investorNotified: boolean;
    acknowledged: boolean;
    resolved: boolean;
    createdAt: Date;
    resolvedAt?: Date;
}

export interface MaintenanceActivity {
    id: number;
    groveId: number;
    farmerAddress: string;
    activityType: 'WATERING' | 'FERTILIZING' | 'PRUNING' | 'PEST_TREATMENT' | 'DISEASE_TREATMENT' | 'SOIL_AMENDMENT';
    description: string;
    cost?: number; // Cost in USDC cents
    materialsUsed: string[]; // Array of materials/chemicals used
    areaTreated?: number; // Area in hectares or number of trees
    weatherConditions?: string;
    notes?: string;
    activityDate: Date;
    createdAt: Date;
}

export interface SensorConfiguration {
    id: number;
    groveId: number;
    sensorType: string;
    optimalMin: number;
    optimalMax: number;
    warningMin: number;
    warningMax: number;
    criticalMin: number;
    criticalMax: number;
    unit: string;
    readingFrequency: number; // Minutes between readings
    alertThresholdCount: number; // Number of consecutive bad readings before alert
    createdAt: Date;
    updatedAt: Date;
}

// Database row types for tree monitoring
export interface IoTSensorDataRow {
    id: number;
    groveId: number;
    sensorId: string;
    sensorType: string;
    value: number;
    unit: string;
    locationLat: number | null;
    locationLng: number | null;
    timestamp: number;
    createdAt: number | null;
}

export interface TreeHealthRecordRow {
    id: number;
    groveId: number;
    healthScore: number;
    assessmentDate: number;
    soilMoistureScore: number | null;
    temperatureScore: number | null;
    humidityScore: number | null;
    phScore: number | null;
    lightScore: number | null;
    rainfallScore: number | null;
    riskFactors: string | null;
    recommendations: string | null;
    yieldImpactProjection: number | null;
    createdAt: number | null;
}

export interface EnvironmentalAlertRow {
    id: number;
    groveId: number;
    alertType: string;
    severity: string;
    title: string;
    message: string;
    sensorDataId: number | null;
    healthRecordId: number | null;
    farmerNotified: boolean;
    investorNotified: boolean;
    acknowledged: boolean;
    resolved: boolean;
    createdAt: number | null;
    resolvedAt: number | null;
}

export interface MaintenanceActivityRow {
    id: number;
    groveId: number;
    farmerAddress: string;
    activityType: string;
    description: string;
    cost: number | null;
    materialsUsed: string | null;
    areaTreated: number | null;
    weatherConditions: string | null;
    notes: string | null;
    activityDate: number;
    createdAt: number | null;
}

export interface SensorConfigurationRow {
    id: number;
    groveId: number;
    sensorType: string;
    optimalMin: number;
    optimalMax: number;
    warningMin: number;
    warningMax: number;
    criticalMin: number;
    criticalMax: number;
    unit: string;
    readingFrequency: number;
    alertThresholdCount: number | null;
    createdAt: number | null;
    updatedAt: number | null;
}

// Investor Verification System Interfaces
export interface InvestorVerification {
    id: number;
    investorAddress: string;
    verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';
    verificationType?: 'basic' | 'accredited';
    documentsHash?: string;
    identityDocumentHash?: string;
    proofOfAddressHash?: string;
    financialStatementHash?: string;
    accreditationProofHash?: string;
    verifierAddress?: string;
    verificationDate?: number;
    expiryDate?: number;
    rejectionReason?: string;
    accessLevel: 'none' | 'limited' | 'full';
    createdAt: number;
    updatedAt: number;
}

export interface InvestorVerificationHistory {
    id: number;
    verificationId: number;
    previousStatus?: string;
    newStatus: string;
    actionType: 'submit' | 'approve' | 'reject' | 'expire' | 'renew';
    verifierAddress?: string;
    reason?: string;
    timestamp: number;
}

export interface InvestorProfile {
    id: number;
    investorAddress: string;
    name?: string;
    email?: string;
    phone?: string;
    country?: string;
    investorType?: 'individual' | 'institutional' | 'accredited';
    riskTolerance?: 'low' | 'medium' | 'high';
    investmentPreferences?: string; // JSON string
    createdAt: number;
    updatedAt: number;
}

// Database row types for investor verification
export interface InvestorVerificationRow {
    id: number;
    investorAddress: string;
    verificationStatus: string | null;
    verificationType: string | null;
    documentsHash: string | null;
    identityDocumentHash: string | null;
    proofOfAddressHash: string | null;
    financialStatementHash: string | null;
    accreditationProofHash: string | null;
    verifierAddress: string | null;
    verificationDate: number | null;
    expiryDate: number | null;
    rejectionReason: string | null;
    accessLevel: string | null;
    createdAt: number | null;
    updatedAt: number | null;
}

export interface InvestorVerificationHistoryRow {
    id: number;
    verificationId: number;
    previousStatus: string | null;
    newStatus: string;
    actionType: string;
    verifierAddress: string | null;
    reason: string | null;
    timestamp: number | null;
}

export interface InvestorProfileRow {
    id: number;
    investorAddress: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    investorType: string | null;
    riskTolerance: string | null;
    investmentPreferences: string | null;
    createdAt: number | null;
    updatedAt: number | null;
}