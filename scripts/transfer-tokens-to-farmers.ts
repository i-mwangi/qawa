/**
 * CLI Script: Transfer Tokens to Farmers
 * 
 * Usage:
 * - Transfer to specific grove: node --loader tsx scripts/transfer-tokens-to-farmers.ts --grove-id 23
 * - Transfer to all groves: node --loader tsx scripts/transfer-tokens-to-farmers.ts --all
 * - Custom percentage: node --loader tsx scripts/transfer-tokens-to-farmers.ts --grove-id 23 --percentage 40
 */

import { transferTokensToFarmer, batchTransferToFarmers, getGrovesNeedingTransfer } from '../api/transfer-tokens-to-farmer'

async function main() {
    const args = process.argv.slice(2)
    
    // Parse arguments
    const groveIdArg = args.find(arg => arg.startsWith('--grove-id='))
    const percentageArg = args.find(arg => arg.startsWith('--percentage='))
    const allFlag = args.includes('--all')
    
    const groveId = groveIdArg ? parseInt(groveIdArg.split('=')[1]) : null
    const percentage = percentageArg ? parseInt(percentageArg.split('=')[1]) : 30

    console.log('🚀 Token Transfer Script')
    console.log('========================\n')

    if (allFlag) {
        // Transfer to all groves
        console.log('📋 Getting all tokenized groves...\n')
        const groves = await getGrovesNeedingTransfer()
        
        if (groves.length === 0) {
            console.log('❌ No tokenized groves found')
            return
        }

        console.log(`Found ${groves.length} tokenized groves:\n`)
        groves.forEach((grove, index) => {
            console.log(`${index + 1}. ${grove.groveName} (ID: ${grove.groveId})`)
            console.log(`   Token: ${grove.tokenAddress}`)
            console.log(`   Farmer: ${grove.farmerAddress}`)
            console.log(`   Total Tokens: ${grove.totalTokens}`)
            console.log(`   Will transfer: ${Math.floor(grove.totalTokens * percentage / 100)} (${percentage}%)\n`)
        })

        console.log('🔄 Starting batch transfer...\n')
        const results = await batchTransferToFarmers(
            groves.map(g => g.groveId),
            percentage
        )

        // Summary
        console.log('\n📊 Transfer Summary:')
        console.log('===================')
        const successful = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success).length
        console.log(`✅ Successful: ${successful}`)
        console.log(`❌ Failed: ${failed}`)

        if (failed > 0) {
            console.log('\n❌ Failed Transfers:')
            results.filter(r => !r.success).forEach(r => {
                console.log(`   - ${r.groveName}: ${r.error}`)
            })
        }

    } else if (groveId) {
        // Transfer to specific grove
        console.log(`📤 Transferring ${percentage}% of tokens to farmer for grove ID: ${groveId}\n`)
        
        const result = await transferTokensToFarmer(groveId, percentage)

        if (result.success) {
            console.log('\n✅ Transfer Successful!')
            console.log(`   Grove: ${result.groveName}`)
            console.log(`   Token: ${result.tokenId}`)
            console.log(`   Tokens Transferred: ${result.tokensTransferred}`)
        } else {
            console.log('\n❌ Transfer Failed!')
            console.log(`   Error: ${result.error}`)
        }

    } else {
        // Show usage
        console.log('Usage:')
        console.log('------')
        console.log('Transfer to specific grove:')
        console.log('  npm run transfer-tokens -- --grove-id=23')
        console.log('')
        console.log('Transfer to specific grove with custom percentage:')
        console.log('  npm run transfer-tokens -- --grove-id=23 --percentage=40')
        console.log('')
        console.log('Transfer to all groves:')
        console.log('  npm run transfer-tokens -- --all')
        console.log('')
        console.log('Transfer to all groves with custom percentage:')
        console.log('  npm run transfer-tokens -- --all --percentage=50')
    }
}

main().catch(console.error)
