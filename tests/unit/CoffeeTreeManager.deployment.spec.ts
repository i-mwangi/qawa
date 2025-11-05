import { describe, it, expect, beforeAll } from 'vitest';
import { Client, ContractCreateFlow, ContractFunctionParameters, ContractCallQuery, AccountId, PrivateKey, Hbar } from '@hashgraph/sdk';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

describe('CoffeeTreeManager - Deployment Tests', () => {
  let client: Client;
  let operatorId: AccountId;
  let operatorKey: PrivateKey;
  let contractId: string;
  
  const GROVE_NAME = 'Test Grove';
  const TOKEN_SYMBOL = 'TGRV';
  const LOCATION = 'Test Location';
  const COFFEE_VARIETY = 'Arabica';
  const EXPECTED_YIELD = 100;

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
  });

  it('should deploy contract successfully without token creation', async () => {
    // Read contract bytecode
    const bytecode = fs.readFileSync(
      path.join(process.cwd(), 'abi/contracts_CoffeeTreeManager_sol_CoffeeTreeManager.bin'),
      'utf8'
    );

    // Deploy contract
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

    expect(contractId).toBeDefined();
    expect(receipt.status.toString()).toBe('SUCCESS');
  }, 120000);

  it('should initialize state variables correctly', async () => {
    // Query admin address
    const adminQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('admin');

    const adminResult = await adminQuery.execute(client);
    const adminAddress = adminResult.getAddress(0);
    
    expect(adminAddress).toBeDefined();
    expect(adminAddress.toLowerCase()).toBe(operatorId.toSolidityAddress().toLowerCase());
  }, 60000);

  it('should have token address as zero after deployment', async () => {
    // Query token address
    const tokenQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('token');

    const tokenResult = await tokenQuery.execute(client);
    const tokenAddress = tokenResult.getAddress(0);
    
    // Token address should be zero (0x0000000000000000000000000000000000000000)
    expect(tokenAddress).toBe('0x0000000000000000000000000000000000000000');
  }, 60000);

  it('should initialize metadata properly', async () => {
    // Query grove name
    const groveNameQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('groveName');

    const groveNameResult = await groveNameQuery.execute(client);
    const groveName = groveNameResult.getString(0);
    
    expect(groveName).toBe(GROVE_NAME);

    // Query location
    const locationQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('getLocation');

    const locationResult = await locationQuery.execute(client);
    const location = locationResult.getString(0);
    
    expect(location).toBe(LOCATION);

    // Query coffee variety
    const varietyQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('getCoffeeVariety');

    const varietyResult = await varietyQuery.execute(client);
    const variety = varietyResult.getString(0);
    
    expect(variety).toBe(COFFEE_VARIETY);

    // Query expected yield
    const yieldQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction('getExpectedYield');

    const yieldResult = await yieldQuery.execute(client);
    const expectedYield = yieldResult.getUint64(0);
    
    expect(expectedYield.toNumber()).toBe(EXPECTED_YIELD);
  }, 120000);
});
