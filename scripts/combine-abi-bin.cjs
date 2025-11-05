const fs = require('fs');
const path = require('path');

// Read the ABI and BIN files
const abiPath = path.join(__dirname, '../abi/contracts_CoffeeTreeManager_sol_CoffeeTreeManager.abi');
const binPath = path.join(__dirname, '../abi/contracts_CoffeeTreeManager_sol_CoffeeTreeManager.bin');

const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
const bin = fs.readFileSync(binPath, 'utf8').trim();

// Create the combined JSON object
const combined = {
  abi: abi,
  bin: bin
};

// Write to the final JSON file
const outputPath = path.join(__dirname, '../abi/CoffeeTreeManager.json');
fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2));

console.log('CoffeeTreeManager.json created successfully');