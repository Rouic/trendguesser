// Script to convert CSV data to JSON format
const fs = require('fs');
const path = require('path');

// Input and output paths
const CSV_PATH = path.join(process.cwd(), 'data', 'seed', 'data.csv');
const JSON_PATH = path.join(process.cwd(), 'data', 'seed', 'terms.json');

// Function to generate a clean ID from a term
function generateId(term) {
  return term.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

// Function to convert CSV to JSON
function convertCsvToJson() {
  try {
    // Check if CSV file exists
    if (!fs.existsSync(CSV_PATH)) {
      console.error(`CSV file not found at: ${CSV_PATH}`);
      process.exit(1);
    }

    // Read CSV file
    const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = csvContent.split('\n');
    
    if (lines.length <= 1) {
      console.error('CSV file is empty or contains only headers');
      process.exit(1);
    }

    // Process CSV data
    const terms = [];
    
    // Skip header (first line)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',');
      if (values.length >= 3) {
        const keyword = values[0].trim();
        const category = values[1].trim().toLowerCase();
        const volume = parseInt(values[2].trim(), 10) || 0;
        
        terms.push({
          id: generateId(keyword),
          term: keyword,
          volume: volume,
          category: category,
          imageUrl: `/api/image?term=${encodeURIComponent(keyword)}`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Write JSON file
    fs.writeFileSync(JSON_PATH, JSON.stringify(terms, null, 2));
    
    console.log(`Successfully converted CSV to JSON.`);
    console.log(`- Input: ${CSV_PATH}`);
    console.log(`- Output: ${JSON_PATH}`);
    console.log(`- Terms: ${terms.length}`);
  } catch (error) {
    console.error('Error converting CSV to JSON:', error);
    process.exit(1);
  }
}

// Run the conversion
convertCsvToJson();