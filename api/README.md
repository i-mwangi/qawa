# Farmer Verification API

This API provides endpoints for farmer verification functionality in the coffee tree tokenization platform. It handles farmer identity verification, document submission, verification approval workflows, and grove ownership registration.

## Base URL

```
http://localhost:3001
```

## Endpoints

### Health Check

**GET** `/health`

Check if the API server is running.

**Response:**
```json
{
  "success": true,
  "message": "Farmer Verification API is running"
}
```

### Submit Verification Documents

**POST** `/api/farmer-verification/submit-documents`

Submit farmer verification documents for identity verification.

**Request Body:**
```json
{
  "farmerAddress": "0x1234567890123456789012345678901234567890",
  "documentsHash": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  "location": "Costa Rica, Central Valley",
  "coordinates": {
    "lat": 9.7489,
    "lng": -83.7534
  }
}
```

**Validation Rules:**
- `farmerAddress`: Must be a valid Ethereum address (0x + 40 hex characters)
- `documentsHash`: Must be a valid IPFS hash (Qm + 44 base58 characters)
- `location`: Required string
- `coordinates.lat`: Must be between -90 and 90
- `coordinates.lng`: Must be between -180 and 180

**Success Response (200):**
```json
{
  "success": true,
  "message": "Documents submitted successfully",
  "data": {
    "farmerAddress": "0x1234567890123456789012345678901234567890",
    "status": "pending",
    "submissionDate": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Invalid input data
- `409`: Farmer is already verified

### Verify Farmer

**POST** `/api/farmer-verification/verify`

Approve or reject a farmer's verification application.

**Request Body:**
```json
{
  "farmerAddress": "0x1234567890123456789012345678901234567890",
  "approved": true,
  "verifierAddress": "0x0987654321098765432109876543210987654321",
  "rejectionReason": "Optional reason if rejected"
}
```

**Validation Rules:**
- `farmerAddress`: Must be a valid Ethereum address
- `approved`: Boolean value
- `verifierAddress`: Must be a valid Ethereum address
- `rejectionReason`: Required if `approved` is false

**Success Response (200):**
```json
{
  "success": true,
  "message": "Farmer verified successfully",
  "data": {
    "farmerAddress": "0x1234567890123456789012345678901234567890",
    "status": "verified",
    "verifierAddress": "0x0987654321098765432109876543210987654321",
    "verificationDate": "2024-01-15T10:30:00.000Z",
    "rejectionReason": null
  }
}
```

**Error Responses:**
- `400`: Invalid input data or missing rejection reason
- `404`: Farmer not found or has not submitted documents
- `409`: Farmer is already verified

### Get Verification Status

**GET** `/api/farmer-verification/status/:farmerAddress`

Get the verification status of a specific farmer.

**Parameters:**
- `farmerAddress`: Ethereum address of the farmer

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "farmerAddress": "0x1234567890123456789012345678901234567890",
    "status": "verified",
    "documentsHash": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    "verifierAddress": "0x0987654321098765432109876543210987654321",
    "verificationDate": "2024-01-15T10:30:00.000Z",
    "rejectionReason": null,
    "submissionDate": "2024-01-15T09:00:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Invalid farmer address format
- `404`: Farmer not found

### Register Grove Ownership

**POST** `/api/farmer-verification/register-grove`

Register grove ownership for a verified farmer.

**Request Body:**
```json
{
  "farmerAddress": "0x1234567890123456789012345678901234567890",
  "groveName": "Costa Rica Coffee Grove #1",
  "ownershipProofHash": "QmTestUwnershipPruufHashFurGruveUwnership12345",
  "verifierAddress": "0x0987654321098765432109876543210987654321"
}
```

**Validation Rules:**
- `farmerAddress`: Must be a valid Ethereum address of a verified farmer
- `groveName`: Required string, must be unique
- `ownershipProofHash`: Must be a valid IPFS hash
- `verifierAddress`: Must be a valid Ethereum address

**Success Response (201):**
```json
{
  "success": true,
  "message": "Grove ownership registered successfully",
  "data": {
    "groveName": "Costa Rica Coffee Grove #1",
    "farmerAddress": "0x1234567890123456789012345678901234567890",
    "ownershipProofHash": "QmTestUwnershipPruufHashFurGruveUwnership12345",
    "verifierAddress": "0x0987654321098765432109876543210987654321",
    "registrationDate": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Invalid input data
- `403`: Farmer must be verified before registering grove ownership
- `409`: Grove name is already registered

### Get Pending Verifications

**GET** `/api/farmer-verification/pending`

Get all farmers with pending verification status (for verifiers).

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "farmerAddress": "0x1111111111111111111111111111111111111111",
      "documentsHash": "QmPending1Hash123456789012345678901234567",
      "submissionDate": "2024-01-15T09:00:00.000Z"
    },
    {
      "farmerAddress": "0x2222222222222222222222222222222222222222",
      "documentsHash": "QmPending2Hash123456789012345678901234567",
      "submissionDate": "2024-01-15T08:30:00.000Z"
    }
  ]
}
```

### File Upload (Placeholder)

**POST** `/api/farmer-verification/upload`

Placeholder endpoint for file uploads. Currently not implemented.

**Response (501):**
```json
{
  "success": false,
  "error": "File upload not implemented. Please use IPFS directly and provide the hash."
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created successfully
- `400`: Bad request (validation errors)
- `403`: Forbidden (authorization errors)
- `404`: Not found
- `409`: Conflict (duplicate data)
- `500`: Internal server error
- `501`: Not implemented

## CORS Support

The API includes CORS headers to allow cross-origin requests:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Database Integration

The API integrates with a SQLite database using Drizzle ORM. The following tables are used:

- `farmer_verifications`: Stores farmer verification data
- `coffee_groves`: Stores grove ownership information

## Requirements Mapping

This API implementation addresses the following requirements from the coffee tree tokenization specification:

- **Requirement 5.1**: Document submission for farmer identity verification
- **Requirement 5.2**: Verification approval and rejection workflows  
- **Requirement 5.3**: Verification status checking
- **Requirement 5.4**: Grove ownership registration for verified farmers

## Testing

The API includes comprehensive unit tests that validate:
- Input validation functions
- API response structures
- Request body interfaces
- Error handling patterns

Run tests with:
```bash
npx tsx --test --test-reporter=spec tests/FarmerVerification/api-unit.spec.ts
```

## Starting the Server

To start the farmer verification API server:

```bash
npm run build
node dist/api/server.js
```

Or for development:
```bash
npx tsx api/server.ts
```

The server will start on port 3001 by default, or the port specified in the `FARMER_VERIFICATION_API_PORT` environment variable.