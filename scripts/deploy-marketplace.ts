/**
 * Deploy Marketplace Contract
 * Deploys the CoffeeTreeMarketplace contract to Hedera
 */

import { 
    Client, 
    ContractCreateFlow, 
    ContractFunctionParameters,
    AccountId,
    PrivateKey
} from '@hashgraph/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function deployMarketplace() {
    // Validate environment variables
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;
    const usdcTokenId = process.env.USDC_TOKEN_ID;
    const issuerContractId = process.env.ISSUER_CONTRACT_ID;

    if (!operatorId || !operatorKey) {
        throw new Error('Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY in .env');
    }

    if (!usdcTokenId) {
        throw new Error('Missing USDC_TOKEN_ID in .env');
    }

    if (!issuerContractId) {
        throw new Error('Missing ISSUER_CONTRACT_ID in .env - deploy CoffeeTreeIssuer first');
    }

    console.log('🚀 Deploying CoffeeTreeMarketplace Contract...\n');
    console.log('Configuration:');
    console.log(`  Operator: ${operatorId}`);
    console.log(`  USDC Token: ${usdcTokenId}`);
    console.log(`  Issuer Contract: ${issuerContractId}\n`);

    // Create Hedera client
    const client = Client.forTestnet();
    client.setOperator(
        AccountId.fromString(operatorId),
        PrivateKey.fromString(operatorKey)
    );

    try {
        // Read compiled contract bytecode
        const bytecode = fs.readFileSync(
            path.join(__dirname, '../artifacts/contracts/CoffeeTreeMarketplace.sol/CoffeeTreeMarketplace.json'),
            'utf8'
        );
        const contractJson = JSON.parse(bytecode);
        const contractBytecode = contractJson.bytecode;

        if (!contractBytecode || contractBytecode === '0x') {
            throw new Error('Contract bytecode not found. Run: npx hardhat compile');
        }

        console.log('📄 Contract bytecode loaded');
        console.log(`   Size: ${contractBytecode.length / 2} bytes\n`);

        // Deploy contract with constructor parameters
        console.log('⏳ Deploying contract...');
        
        const contractCreate = new ContractCreateFlow()
            .setBytecode(contractBytecode)
            .setGas(4000000) // Increased gas for marketplace contract
            .setConstructorParameters(
                new ContractFunctionParameters()
                    .addAddress(issuerContractId) // CoffeeTreeIssuer address
                    .addAddress(usdcTokenId) // USDC token address
            );

        const txResponse = await contractCreate.execute(client);
        const receipt = await txResponse.getReceipt(client);
        const contractId = receipt.contractId;

        if (!contractId) {
            throw new Error('Contract deployment failed - no contract ID returned');
        }

        console.log('✅ Contract deployed successfully!\n');
        console.log('Contract Details:');
        console.log(`  Contract ID: ${contractId.toString()}`);
        console.log(`  Transaction ID: ${txResponse.transactionId.toString()}`);
        console.log(`  Explorer: https://hashscan.io/testnet/contract/${contractId.toString()}\n`);

        // Update .env file
        console.log('📝 Updating .env file...');
        const envPath = path.join(__dirname, '../.env');
        let envContent = fs.readFileSync(envPath, 'utf8');

        // Add or update MARKETPLACE_CONTRACT_ID
        if (envContent.includes('MARKETPLACE_CONTRACT_ID=')) {
            envContent = envContent.replace(
                /MARKETPLACE_CONTRACT_ID=.*/,
                `MARKETPLACE_CONTRACT_ID=${contractId.toString()}`
            );
        } else {
            envContent += `\nMARKETPLACE_CONTRACT_ID=${contractId.toString()}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log('✅ .env file updated\n');

        console.log('🎉 Marketplace deployment complete!\n');
        console.log('Next steps:');
        console.log('1. Associate marketplace contract with USDC token');
        console.log('2. Associate marketplace contract with grove tokens');
        console.log('3. Test listing and purchasing tokens\n');

        return contractId.toString();

    } catch (error) {
        console.error('❌ Deployment failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

// Run deployment
if (require.main === module) {
    deployMarketplace()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export { deployMarketplace };
