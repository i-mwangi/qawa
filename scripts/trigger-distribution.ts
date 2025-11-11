import 'dotenv/config';

async function triggerDistribution() {
  const harvestId = process.argv[2];
  
  if (!harvestId) {
    console.error('❌ Please provide a harvest ID');
    console.log('Usage: npx tsx scripts/trigger-distribution.ts <harvestId>');
    process.exit(1);
  }
  
  console.log(`\n🚀 Triggering distribution for harvest #${harvestId}...\n`);
  
  try {
    const response = await fetch(`http://localhost:3001/harvest/distribute/${harvestId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('\n✅ Distribution triggered successfully!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('\n❌ Distribution failed:', result.error);
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

triggerDistribution();
