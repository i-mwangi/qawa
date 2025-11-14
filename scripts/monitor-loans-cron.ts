/**
 * Loan Monitoring Cron Job
 * Runs periodically to check loan health and trigger liquidations
 */

import * as dotenv from 'dotenv';
dotenv.config();

async function monitorLoans() {
    console.log('🔍 Loan Monitoring Cron Job Started');
    console.log('='.repeat(60));
    console.log(`Time: ${new Date().toISOString()}\n`);

    try {
        // Import liquidation service
        const { liquidationService } = await import('../lib/services/liquidation-service.js');

        // Check monitoring status
        const status = liquidationService.getMonitoringStatus();
        console.log('📊 Monitoring Status:');
        console.log(`   Is Monitoring: ${status.isMonitoring}`);
        console.log(`   Check Interval: ${status.checkInterval / 1000}s\n`);

        // Run monitoring check
        console.log('🔄 Running loan health checks...\n');
        await liquidationService.monitorLoans();

        console.log('\n✅ Monitoring check complete');
        console.log('='.repeat(60));

    } catch (error: any) {
        console.error('\n❌ Monitoring failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run monitoring
monitorLoans().catch(console.error);
