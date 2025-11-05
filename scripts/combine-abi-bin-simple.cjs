const fs = require('fs');
const path = require('path');

// Read the ABI and BIN files
const abiPath = path.join(__dirname, '../abi/contracts_CoffeeTreeManagerSimple_sol_CoffeeTreeManagerSimple.abi');
const binPath = path.join(__dirname, '../abi/contracts_CoffeeTreeManagerSimple_sol_CoffeeTreeManagerSimple.bin');

const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
const bin = fs.readFileSync(binPath, 'utf8').trim();

// Create the combined JSON object
const combined = {
  abi: abi,
  bin: bin
};

// Write to the final JSON file
const outputPath = path.join(__dirname, '../abi/CoffeeTreeManagerSimple.json');
fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2));

console.log('CoffeeTreeManagerSimple.json created successfully');