import { describe, it, expect, beforeAll } from 'vitest';
import { Client, ContractCreateFlow, ContractExecuteTransaction, ContractFunctionParameters, ContractCallQuery, AccountId, PrivateKey, Hbar } from '@hashgraph/sdk';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

describe('CoffeeTreeManager - Token-Dependent Functions Tests', () => {
  let client: Client;
  let operatorId: AccountId;
  let operatorKey: PrivateKey;
  let uninitializedContractId: string;
  let initializedContractId: string;
  
  const GROVE_NAME = 'Token Ops Grove';
  const TOKEN_SYMBOL = 'TOGS';
  const LOCATION = 'Token Ops Location';
  const COFFEE_VARIETY = 'Liberica';
  const EXPECTED_YIELD = 200;

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

    const bytecode = fs.readFileSync(
      path.join(process.cwd(), 'abi/contracts_CoffeeTreeManager_sol_CoffeeTreeManager.bin'),
      'utf8'
    );

    // Deploy uninitialized contract
    const uninitContract = new ContractCreateFlow()
      .setBytecode(bytecode)
      .setGas(3000000)
      .setConstructorParameters(
        new ContractFunctionParameters()
          .addString('Uninit Grove')
          .addString('UGRV')
          .addString(LOCATION)
          .addString(COFFEE_VARIETY)
          .addUint64(EXPECTED_YIELD)
      )
      .setInitialBalance(new Hbar(10));

    const uninitResponse = await uninitContract.execute(client);
    const uninitReceipt = await uninitResponse.getReceipt(client);
    uninitializedContractId = uninitReceipt.contractId!.toString();

    // Deploy and initialize another contract
    const initContract = new ContractCreateFlow()
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

    const initResponse = await initContract.execute(client);
    const initReceipt = await initResponse.getReceipt(client);
    initializedContractId = initReceipt.contractId!.toString();

    // Initialize token
    const initTx = new ContractExecuteTransaction()
      .setContractId(initializedContractId)
      .setGas(2000000)
      .setFunction('initializeToken');

    await initTx.execute(client);
  }, 240000);

  describe('mint() function', () => {
    it('should fail before token initialization', async () => {
      const mintTx = new ContractExecuteTransaction()
        .setContractId(uninitializedContractId)
        .setGas(300000)
        .setFunction('mint', new ContractFunctionParameters().addUint64(100));

      try {
        await mintTx.execute(client);
        expect(true).toBe(false); // Force failure if no error
      } catch (error: any) {
        expect(error.message).toContain('CONTRACT_REVERT_EXECUTED');
      }
    }, 120000);

    it('should succeed after token initialization', async () => {
      const mintTx = new ContractExecuteTransaction()
        .setContractId(initializedContractId)
        .setGas(300000)
        .setFunction('mint', new ContractFunctionParameters().addUint64(100));

      const txResponse = await mintTx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      
      expect(receipt.status.toString()).toBe('SUCCESS');

      // Verify total supply increased
      const supplyQuery = new ContractCallQuery()
        .setContractId(initializedContractId)
        .setGas(100000)
        .setFunction('totalSupply');

      const supplyResult = await supplyQuery.execute(client);
      const totalSupply = supplyResult.getUint64(0);
      
      expect(totalSupply.toNumber()).toBe(100);
    }, 120000);
  });

  describe('burn() function', () => {
    it('should require token initialization', async () => {
      const burnTx = new ContractExecuteTransaction()
        .setContractId(uninitializedContractId)
        .setGas(300000)
        .setFunction('burn', new ContractFunctionParameters().addUint64(10));

      try {
        await burnTx.execute(client);
        expect(true).toBe(false); // Force failure if no error
      } catch (error: any) {
        expect(error.message).toContain('CONTRACT_REVERT_EXECUTED');
      }
    }, 120000);
  });

  describe('grantKYC() function', () => {
    it('should require token initialization', async () => {
      const kycTx = new ContractExecuteTransaction()
        .setContractId(uninitializedContractId)
        .setGas(300000)
        .setFunction('grantKYC', new ContractFunctionParameters().addAddress(operatorId.toSolidityAddress()));

      try {
        await kycTx.execute(client);
        expect(true).toBe(false); // Force failure if no error
      } catch (error: any) {
        expect(error.message).toContain('CONTRACT_REVERT_EXECUTED');
      }
    }, 120000);
  });

  describe('airdropPurchasedTokens() function', () => {
    it('should require token initialization', async () => {
      const airdropTx = new ContractExecuteTransaction()
        .setContractId(uninitializedContractId)
        .setGas(300000)
        .setFunction(
          'airdropPurchasedTokens',
          new ContractFunctionParameters()
            .addAddress(operatorId.toSolidityAddress())
            .addUint64(10)
        );

      try {
        await airdropTx.execute(client);
        expect(true).toBe(false); // Force failure if no error
      } catch (error: any) {
        expect(error.message).toContain('CONTRACT_REVERT_EXECUTED');
      }
    }, 120000);
  });

  describe('airdropRevenueTokens() function', () => {
    it('should require token initialization', async () => {
      const holders = [operatorId.toSolidityAddress()];
      const amounts = [10];

      const airdropTx = new ContractExecuteTransaction()
        .setContractId(uninitializedContractId)
        .setGas(300000)
        .setFunction(
          'airdropRevenueTokens',
          new ContractFunctionParameters()
            .addAddressArray(holders)
            .addUint64Array(amounts)
        );

      try {
        await airdropTx.execute(client);
        expect(true).toBe(false); // Force failure if no error
      } catch (error: any) {
        expect(error.message).toContain('CONTRACT_REVERT_EXECUTED');
      }
    }, 120000);
  });
});
