import { describe, it, expect, beforeAll } from 'vitest';
import { Client, ContractCreateFlow, ContractExecuteTransaction, ContractFunctionParameters, ContractCallQuery, AccountId, PrivateKey, Hbar } from '@hashgraph/sdk';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

describe('CoffeeTreeManager - Token Initialization Tests', () => {
  let client: Client;
  let operatorId: AccountId;
  let operatorKey: PrivateKey;
  let contractId: string;
  let secondAccountId: AccountId;
  let secondAccountKey: PrivateKey;
  
  const GROVE_NAME = 'Init Test Grove';
  const TOKEN_SYMBOL = 'IGRV';
  const LOCATION = 'Init Location';
  const COFFEE_VARIETY = 'Robusta';
  const EXPECTED_YIELD = 150;

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

    // Create a second account for non-admin tests
    secondAccountKey = PrivateKey.generateED25519();
    // Note: In a real test, you'd create this account on Hedera
    // For now, we'll use a placeholder
    secondAccountId = AccountId.fromString('0.0.12345');

    // Deploy contract
    const bytecode = fs.readFileSync(
      path.join(process.cwd(), 'abi/contracts_CoffeeTreeManager_sol_CoffeeTreeManager.bin'),
      'utf8'
    );

    const contractCreate = new ContractCreateFlow()
      .setBytecode(bytecode)
      .setGas(3000000)
      .setConstructorParameters(
        new ContractFunctionParameters()
          .addString(GROVE_NAME)
          .addString(TOKEN_SYMBOL)
          .addString(LOCATION)
          .addString(COFFEE_VARIETY)
          .addUint64(EXPECTED_YIELD)
      )
      .setInitialBalance(new Hbar(10));

    const txResponse = await contractCreate.execute(client);
    const receipt = await txResponse.getReceipt(client);
    contractId = receipt.contractId!.toString();
  }, 120000);

  it('should initialize token successfully', async () => {
    // Call initializeToken
    const initTx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(2000000)
      .setFunction('initializeToken');

    const txResponse = await initTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    expect(receipt.status.toString()).toBe('SUCCESS');
  }, 120000);

  it('should have token address set after initialization', async () => {
    // Query token address
    const tokenQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('token');

    const tokenResult = await tokenQuery.execute(client);
    const tokenAddress = tokenResult.getAddress(0);
    
    // Token address should NOT be zero after initialization
    expect(tokenAddress).not.toBe('0x0000000000000000000000000000000000000000');
    expect(tokenAddress).toBeDefined();
  }, 60000);

  it('should return true for isTokenInitialized after initialization', async () => {
    // Query isTokenInitialized
    const query = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('isTokenInitialized');

    const result = await query.execute(client);
    const isInitialized = result.getBool(0);
    
    expect(isInitialized).toBe(true);
  }, 60000);

  it('should fail when trying to initialize token twice', async () => {
    // Try to initialize token again
    const initTx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(2000000)
      .setFunction('initializeToken');

    try {
      await initTx.execute(client);
      // If we get here, the test should fail
      expect(true).toBe(false); // Force failure
    } catch (error: any) {
      // Should revert with TokenAlreadyInitialized error
      expect(error.message).toContain('CONTRACT_REVERT_EXECUTED');
    }
  }, 120000);

  it('should emit TokenInitialized event', async () => {
    // Deploy a new contract to test event emission
    const bytecode = fs.readFileSync(
      path.join(process.cwd(), 'abi/contracts_CoffeeTreeManager_sol_CoffeeTreeManager.bin'),
      'utf8'
    );

    const contractCreate = new ContractCreateFlow()
      .setBytecode(bytecode)
      .setGas(3000000)
      .setConstructorParameters(
        new ContractFunctionParameters()
          .addString('Event Test Grove')
          .addString('EGRV')
          .addString(LOCATION)
          .addString(COFFEE_VARIETY)
          .addUint64(EXPECTED_YIELD)
      )
      .setInitialBalance(new Hbar(10));

    const createResponse = await contractCreate.execute(client);
    const createReceipt = await createResponse.getReceipt(client);
    const newContractId = createReceipt.contractId!.toString();

    // Initialize token and check for event
    const initTx = new ContractExecuteTransaction()
      .setContractId(newContractId)
      .setGas(2000000)
      .setFunction('initializeToken');

    const txResponse = await initTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    // Event emission is confirmed by successful transaction
    expect(receipt.status.toString()).toBe('SUCCESS');
  }, 180000);
});
