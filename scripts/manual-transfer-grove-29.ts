/**
 * Manual transfer for Grove ID 29 (questValley)
 * Transfers 100% of tokens to farmer
 */

import { transferTokensToFarmer } from '../api/transfer-tokens-to-farmer.js'

async function main() {
    console.log('🚀 Transferring tokens for Grove ID 29 (questValley)')
    console.log('   Token: 0.0.7143639')
    console.log('   Farmer: 0.0.7135914')
    console.log('   Amount: 100% (190,000 tokens)\n')

    const result = await transferTokensToFarmer(29, 100)

    if (result.success) {
        console.log('\n✅ Transfer Successful!')
        console.log(`   Grove: ${result.groveName}`)
        console.log(`   Token: ${result.tokenId}`)
        console.log(`   Tokens Transferred: ${result.tokensTransferred}`)
        console.log(`\n🎉 Farmer now owns all tokens!`)
        console.log(`   Check HashPack wallet: 0.0.7135914`)
    } else {
        console.log('\n❌ Transfer Failed!')
        console.log(`   Error: ${result.error}`)
    }
}

main().catch(console.error)
