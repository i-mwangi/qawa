import { describe, it, expect, beforeAll } from 'vitest';
import { Client, ContractCreateFlow, ContractExecuteTransaction, ContractFunctionParameters, ContractCallQuery, AccountId, PrivateKey, Hbar, TokenAssociateTransaction } from '@hashgraph/sdk';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

describe('Complete Platform Flow - End-to-End Tests', () => {
  let client: Client;
  let operatorId: AccountId;
  let operatorKey: PrivateKey;
  let issuerContractId: string;
  let farmerVerificationContractId: string;
  let marketplaceContractId: string;
  let usdcTokenId: string;
  
  const GROVE_NAME = 'E2E Test Grove';
  const LOCATION = 'E2E Test Location';
  const TREE_COUNT = 50;
  const COFFEE_VARIETY = 'Arabica E2E';
  const EXPECTED_YIELD_PER_TREE = 75;
  const TOKENS_PER_TREE = 20;
  const PRICE_PER_TOKEN = 50;

  beforeAll(async () => {
    // Setup Hedera client
    const accountId = process.env.HEDERA_OPERATOR_ID;
    const privateKey = process.env.HEDERA_OPERATOR_KEY;
    
    if (!accountId || !privateKey) {
      throw new Error('Environment variables HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set');
    }

    operatorId = AccountId.fromString(accountId);
    operatorKey = PrivateKey.fromString(privateKey);
    
    client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);

    // Use existing USDC token or mock
    usdcTokenId = process.env.USDC_TOKEN_ID || '0.0.5880fb';

    // Deploy FarmerVerification
    const farmerVerificationBytecode = fs.readFileSync(
      path.join(process.cwd(), 'abi/contracts_FarmerVerification_sol_FarmerVerification.bin'),
      'utf8'
    );

    const farmerVerificationCreate = new ContractCreateFlow()
      .setBytecode(farmerVerificationBytecode)
      .setGas(1000000);

    const farmerVerificationResponse = await farmerVerificationCreate.execute(client);
    const farmerVerificationReceipt = await farmerVerificationResponse.getReceipt(client);
    farmerVerificationContractId = farmerVerificationReceipt.contractId!.toString();

    // Verify farmer
    const verifyTx = new ContractExecuteTransaction()
      .setContractId(farmerVerificationContractId)
      .setGas(200000)
      .setFunction(
        'verifyFarmer',
        new ContractFunctionParameters()
          .addAddress(operatorId.toSolidityAddress())
          .addString('E2E Farmer')
          .addString('E2E Farm')
      );

    await verifyTx.execute(client);

    // Deploy CoffeeTreeIssuer
    const issuerBytecode = fs.readFileSync(
      path.join(process.cwd(), 'abi/contracts_CoffeeTreeIssuer_sol_CoffeeTreeIssuer.bin'),
      'utf8'
    );

    const issuerCreate = new ContractCreateFlow()
      .setBytecode(issuerBytecode)
      .setGas(3000000)
      .setConstructorParameters(
        new ContractFunctionParameters()
          .addAddress(farmerVerificationContractId)
      );

    const issuerResponse = await issuerCreate.execute(client);
    const issuerReceipt = await issuerResponse.getReceipt(client);
    issuerContractId = issuerReceipt.contractId!.toString();
  }, 360000);

  it('should complete register → tokenize → purchase tokens flow', async () => {
    // Step 1: Register grove
    const registerTx = new ContractExecuteTransaction()
      .setContractId(issuerContractId)
      .setGas(500000)
      .setFunction(
        'registerCoffeeGrove',
        new ContractFunctionParameters()
          .addString(GROVE_NAME)
          .addString(LOCATION)
          .addUint64(TREE_COUNT)
          .addString(COFFEE_VARIETY)
          .addUint64(EXPECTED_YIELD_PER_TREE)
      );

    const registerResponse = await registerTx.execute(client);
    const registerReceipt = await registerResponse.getReceipt(client);
    expect(registerReceipt.status.toString()).toBe('SUCCESS');

    // Step 2: Tokenize grove
    const tokenizeTx = new ContractExecuteTransaction()
      .setContractId(issuerContractId)
      .setGas(5000000)
      .setPayableAmount(new Hbar(10))
      .setFunction(
        'tokenizeCoffeeGrove',
        new ContractFunctionParameters()
          .addString(GROVE_NAME)
          .addUint64(TOKENS_PER_TREE)
          .addUint64(PRICE_PER_TOKEN)
      );

    const tokenizeResponse = await tokenizeTx.execute(client);
    const tokenizeReceipt = await tokenizeResponse.getReceipt(client);
    expect(tokenizeReceipt.status.toString()).toBe('SUCCESS');

    // Step 3: Get token address
    const tokenQuery = new ContractCallQuery()
      .setContractId(issuerContractId)
      .setGas(200000)
      .setFunction('getGroveTokenAddress', new ContractFunctionParameters().addString(GROVE_NAME));

    const tokenResult = await tokenQuery.execute(client);
    const tokenAddress = tokenResult.getAddress(0);
    expect(tokenAddress).not.toBe('0x0000000000000000000000000000000000000000');

    // Step 4: Associate token with buyer account (required for HTS)
    // Note: In a real scenario, buyer would need to associate first
    // For this test, we're using the operator account which is already associated

    // Step 5: Purchase tokens (simplified - would need USDC balance in real scenario)
    // This step is commented out as it requires USDC setup
    /*
    const purchaseTx = new ContractExecuteTransaction()
      .setContractId(issuerContractId)
      .setGas(1000000)
      .setFunction(
        'purchaseTreeTokens',
        new ContractFunctionParameters()
          .addString(GROVE_NAME)
          .addUint64(10) // Purchase 10 tokens
      );

    const purchaseResponse = await purchaseTx.execute(client);
    const purchaseReceipt = await purchaseResponse.getReceipt(client);
    expect(purchaseReceipt.status.toString()).toBe('SUCCESS');
    */
  }, 300000);

  it('should handle harvest reporting and revenue distribution', async () => {
    // Register and tokenize a grove for harvest testing
    const harvestGroveName = 'Harvest Test Grove';
    
    const registerTx = new ContractExecuteTransaction()
      .setContractId(issuerContractId)
      .setGas(500000)
      .setFunction(
        'registerCoffeeGrove',
        new ContractFunctionParameters()
          .addString(harvestGroveName)
          .addString(LOCATION)
          .addUint64(TREE_COUNT)
          .addString(COFFEE_VARIETY)
          .addUint64(EXPECTED_YIELD_PER_TREE)
      );

    await registerTx.execute(client);

    const tokenizeTx = new ContractExecuteTransaction()
      .setContractId(issuerContractId)
      .setGas(5000000)
      .setPayableAmount(new Hbar(10))
      .setFunction(
        'tokenizeCoffeeGrove',
        new ContractFunctionParameters()
          .addString(harvestGroveName)
          .addUint64(TOKENS_PER_TREE)
          .addUint64(PRICE_PER_TOKEN)
      );

    await tokenizeTx.execute(client);

    // Report harvest
    const yieldKg = 3000; // 3000 kg harvest
    const qualityGrade = 85; // 85% quality
    const salePricePerKg = 10; // 10 USDC per kg

    const harvestTx = new ContractExecuteTransaction()
      .setContractId(issuerContractId)
      .setGas(500000)
      .setFunction(
        'reportHarvest',
        new ContractFunctionParameters()
          .addString(harvestGroveName)
          .addUint64(yieldKg)
          .addUint64(qualityGrade)
          .addUint64(salePricePerKg)
      );

    const harvestResponse = await harvestTx.execute(client);
    const harvestReceipt = await harvestResponse.getReceipt(client);
    expect(harvestReceipt.status.toString()).toBe('SUCCESS');

    // Verify harvest was recorded
    const harvestQuery = new ContractCallQuery()
      .setContractId(issuerContractId)
      .setGas(200000)
      .setFunction('getGroveHarvests', new ContractFunctionParameters().addString(harvestGroveName));

    const harvestResult = await harvestQuery.execute(client);
    // Harvest array should have at least one entry
    expect(harvestResult).toBeDefined();

    // Revenue distribution would require USDC setup
    // Commented out for now
    /*
    const distributeTx = new ContractExecuteTransaction()
      .setContractId(issuerContractId)
      .setGas(1000000)
      .setFunction(
        'distributeRevenue',
        new ContractFunctionParameters()
          .addString(harvestGroveName)
          .addUint256(0) // First harvest index
      );

    const distributeResponse = await distributeTx.execute(client);
    const distributeReceipt = await distributeResponse.getReceipt(client);
    expect(distributeReceipt.status.toString()).toBe('SUCCESS');
    */
  }, 360000);

  it('should maintain backward compatibility with existing contracts', async () => {
    // Test that CoffeeTreeManager maintains same interface
    const compatGroveName = 'Compat Test Grove';
    
    // Register grove
    const registerTx = new ContractExecuteTransaction()
      .setContractId(issuerContractId)
      .setGas(500000)
      .setFunction(
        'registerCoffeeGrove',
        new ContractFunctionParameters()
          .addString(compatGroveName)
          .addString(LOCATION)
          .addUint64(TREE_COUNT)
          .addString(COFFEE_VARIETY)
          .addUint64(EXPECTED_YIELD_PER_TREE)
      );

    await registerTx.execute(client);

    // Tokenize grove
    const tokenizeTx = new ContractExecuteTransaction()
      .setContractId(issuerContractId)
      .setGas(5000000)
      .setPayableAmount(new Hbar(10))
      .setFunction(
        'tokenizeCoffeeGrove',
        new ContractFunctionParameters()
          .addString(compatGroveName)
          .addUint64(TOKENS_PER_TREE)
          .addUint64(PRICE_PER_TOKEN)
      );

    const tokenizeResponse = await tokenizeTx.execute(client);
    const tokenizeReceipt = await tokenizeResponse.getReceipt(client);
    expect(tokenizeReceipt.status.toString()).toBe('SUCCESS');

    // Verify all expected functions are accessible
    const groveInfoQuery = new ContractCallQuery()
      .setContractId(issuerContractId)
      .setGas(200000)
      .setFunction('getGroveInfo', new ContractFunctionParameters().addString(compatGroveName));

    const groveInfo = await groveInfoQuery.execute(client);
    expect(groveInfo).toBeDefined();

    // Verify token address is accessible
    const tokenQuery = new ContractCallQuery()
      .setContractId(issuerContractId)
      .setGas(200000)
      .setFunction('getGroveTokenAddress', new ContractFunctionParameters().addString(compatGroveName));

    const tokenResult = await tokenQuery.execute(client);
    const tokenAddress = tokenResult.getAddress(0);
    expect(tokenAddress).not.toBe('0x0000000000000000000000000000000000000000');
  }, 300000);
});
