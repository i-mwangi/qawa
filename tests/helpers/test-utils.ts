import { Client, AccountId, PrivateKey, ContractCreateFlow, ContractFunctionParameters, Hbar } from '@hashgraph/sdk';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Setup Hedera test client
 */
export function setupTestClient(): { client: Client; operatorId: AccountId; operatorKey: PrivateKey } {
  const accountId = process.env.HEDERA_OPERATOR_ID;
  const privateKey = process.env.HEDERA_OPERATOR_KEY;
  
  if (!accountId || !privateKey) {
    throw new Error('Environment variables HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set');
  }

  const operatorId = AccountId.fromString(accountId);
  const operatorKey = PrivateKey.fromString(privateKey);
  
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);

  return { client, operatorId, operatorKey };
}

/**
 * Deploy CoffeeTreeManager contract
 */
export async function deployCoffeeTreeManager(
  client: Client,
  groveName: string,
  tokenSymbol: string,
  location: string,
  coffeeVariety: string,
  expectedYield: number
): Promise<string> {
  const bytecode = fs.readFileSync(
    path.join(process.cwd(), 'abi/contracts_CoffeeTreeManager_sol_CoffeeTreeManager.bin'),
    'utf8'
  );

  const contractCreate = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(3000000)
    .setConstructorParameters(
      new ContractFunctionParameters()
        .addString(groveName)
        .addString(tokenSymbol)
        .addString(location)
        .addString(coffeeVariety)
        .addUint64(expectedYield)
    )
    .setInitialBalance(new Hbar(10));

  const txResponse = await contractCreate.execute(client);
  const receipt = await txResponse.getReceipt(client);
  
  return receipt.contractId!.toString();
}

/**
 * Deploy FarmerVerification contract
 */
export async function deployFarmerVerification(client: Client): Promise<string> {
  const bytecode = fs.readFileSync(
    path.join(process.cwd(), 'abi/contracts_FarmerVerification_sol_FarmerVerification.bin'),
    'utf8'
  );

  const contractCreate = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(1000000);

  const txResponse = await contractCreate.execute(client);
  const receipt = await txResponse.getReceipt(client);
  
  return receipt.contractId!.toString();
}

/**
 * Deploy CoffeeTreeIssuer contract
 */
export async function deployCoffeeTreeIssuer(
  client: Client,
  farmerVerificationAddress: string
): Promise<string> {
  const bytecode = fs.readFileSync(
    path.join(process.cwd(), 'abi/contracts_CoffeeTreeIssuer_sol_CoffeeTreeIssuer.bin'),
    'utf8'
  );

  const contractCreate = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(3000000)
    .setConstructorParameters(
      new ContractFunctionParameters()
        .addAddress(farmerVerificationAddress)
    );

  const txResponse = await contractCreate.execute(client);
  const receipt = await txResponse.getReceipt(client);
  
  return receipt.contractId!.toString();
}

/**
 * Wait for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random grove name for testing
 */
export function generateRandomGroveName(): string {
  return `Test Grove ${Math.random().toString(36).substring(7)}`;
}
