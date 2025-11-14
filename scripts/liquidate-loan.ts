/**
 * Manual Loan Liquidation Script
 * Allows manual liquidation of a specific loan
 */

import * as dotenv from 'dotenv';
dotenv.config();

async function liquidateLoan() {
    const loanId = process.argv[2];

    if (!loanId) {
        console.error('❌ Error: Loan ID is required');
        console.log('\nUsage: npm run tsx scripts/liquidate-loan.ts <loanId>');
        console.log('Example: npm run tsx scripts/liquidate-loan.ts loan_1234567890_abc123\n');
        process.exit(1);
    }

    console.log('⚡ Manual Loan Liquidation');
    console.log('='.repeat(60));
    console.log(`Loan ID: ${loanId}`);
    console.log(`Time: ${new Date().toISOString()}\n`);

    try {
        // Import services
        const { liquidationService } = await import('../lib/services/liquidation-service.js');
        const { loanManagementService } = await import('../lib/services/loan-management-service.js');
        const { priceOracleService } = await import('../lib/services/price-oracle-service.js');

        // Get loan details
        console.log('📋 Fetching loan details...');
        const loan = await loanManagementService.getLoan(loanId);

        if (!loan) {
            console.error(`❌ Loan not found: ${loanId}`);
            process.exit(1);
        }

        console.log('\nLoan Details:');
        console.log(`  Borrower: ${loan.borrowerAccount}`);
        console.log(`  Loan Amount: ${loan.loanAmountUsdc} USDC`);
        console.log(`  Collateral: ${loan.collateralAmount} tokens (${loan.collateralTokenId})`);
        console.log(`  Status: ${loan.status}`);
        console.log(`  Health Factor: ${loan.healthFactor}`);

        if (loan.status !== 'active') {
            console.error(`\n❌ Cannot liquidate: Loan is not active (status: ${loan.status})`);
            process.exit(1);
        }

        // Get current price
        console.log('\n💰 Fetching current collateral price...');
        const currentPrice = await priceOracleService.getTokenPrice(loan.collateralTokenId);
        console.log(`  Current Price: $${currentPrice}`);

        // Calculate current health
        const collateralValue = loan.collateralAmount * currentPrice;
        const currentHealthFactor = (collateralValue * loan.liquidationThreshold) / loan.loanAmountUsdc;
        console.log(`  Collateral Value: $${collateralValue.toFixed(2)}`);
        console.log(`  Current Health Factor: ${currentHealthFactor.toFixed(4)}`);

        // Check if should liquidate
        const shouldLiquidate = await liquidationService.shouldLiquidate(loan, currentPrice);

        if (!shouldLiquidate) {
            console.log('\n⚠️  Warning: Loan health factor is above liquidation threshold');
            console.log(`   Current: ${currentHealthFactor.toFixed(4)}`);
            console.log(`   Threshold: 1.0`);
            console.log('\n   Liquidation not recommended. Continue anyway? (Ctrl+C to cancel)');
            
            // Wait 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Execute liquidation
        console.log('\n⚡ Executing liquidation...');
        const result = await liquidationService.executeLiquidation(loanId);

        if (result.success) {
            console.log('\n✅ Liquidation Successful!');
            console.log('='.repeat(60));
            console.log('Liquidation Details:');
            console.log(`  Loan ID: ${result.loanId}`);
            console.log(`  Collateral Sold: ${result.collateralSold} tokens`);
            console.log(`  USDC Recovered: $${result.usdcRecovered.toFixed(2)}`);
            console.log(`  Liquidation Penalty: $${result.liquidationPenalty.toFixed(2)}`);
            if (result.liquidatorReward) {
                console.log(`  Liquidator Reward: $${result.liquidatorReward.toFixed(2)}`);
            }
            if (result.transactionHash) {
                console.log(`  Transaction Hash: ${result.transactionHash}`);
            }
            console.log('='.repeat(60));
        } else {
            console.error('\n❌ Liquidation Failed!');
            console.error(`Error: ${result.error}`);
            process.exit(1);
        }

    } catch (error: any) {
        console.error('\n❌ Liquidation failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run liquidation
liquidateLoan().catch(console.error);
