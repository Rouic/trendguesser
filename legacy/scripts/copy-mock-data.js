// Extract data from mockData.ts and save as JSON
const fs = require('fs');
const path = require('path');

// Read the sample terms from mockData.ts
const mockDataPath = path.join(process.cwd(), '../', 'src', 'lib', 'mockData.ts');
const mockData = fs.readFileSync(mockDataPath, 'utf8');

// Extract the sampleSearchTerms array
const termsMatch = mockData.match(/export const sampleSearchTerms: SearchTerm\[\] = \[([\s\S]*?)\];/);
if (!termsMatch) {
  console.error('Could not find sampleSearchTerms in mockData.ts');
  process.exit(1);
}

// Convert to a JSON structure
const termsContent = termsMatch[1];
let jsonString = '[\n' + termsContent
  .replace(/\/\/ .*?$/gm, '') // Remove comments
  .replace(/(\w+):/g, '"$1":') // Add quotes to keys
  .replace(/,\s*\n\s*\]/g, '\n  }') // Fix last item
  .replace(/\n\s*{/g, '\n  {') // Indentation
  .replace(/: new Date.*?,/g, ': "2023-04-14T12:00:00.000Z",') // Fix timestamps
  + '\n]';

// Clean up any remaining syntax issues
jsonString = jsonString
  .replace(/'/g, '"') // Replace single quotes with double quotes
  .replace(/,(\s*\n\s*})/g, '$1') // Remove trailing commas in objects
  .replace(/,(\s*\n\s*\])/g, '$1'); // Remove trailing comma in array

// Write to the seed file
const seedDir = path.join(process.cwd(), 'data', 'seed');
if (!fs.existsSync(seedDir)) {
  fs.mkdirSync(seedDir, { recursive: true });
}

const seedPath = path.join(seedDir, 'terms.json');
fs.writeFileSync(seedPath, jsonString);

console.log('Created seed data file at', seedPath);
