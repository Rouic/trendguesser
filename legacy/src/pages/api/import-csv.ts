import { NextApiRequest, NextApiResponse } from 'next';
import { importData } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      // Check if the request contains CSV data
      const { csvData } = req.body;
      
      if (csvData && typeof csvData === 'string') {
        // Import the CSV data
        await importData(csvData);
        return res.status(200).json({ success: true, message: 'CSV data imported successfully' });
      }
      
      // If no CSV data in request, try to load from file
      const csvPath = path.join(process.cwd(), 'data', 'import.csv');
      
      if (fs.existsSync(csvPath)) {
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        await importData(csvContent);
        return res.status(200).json({ 
          success: true, 
          message: 'CSV data imported successfully from file' 
        });
      }
      
      // If no local file, try to use the sample data from functions dir
      try {
        const functionsPath = path.join(process.cwd(), 'functions', 'src', 'data.csv');
        if (fs.existsSync(functionsPath)) {
          const csvContent = fs.readFileSync(functionsPath, 'utf8');
          await importData(csvContent);
          return res.status(200).json({ 
            success: true, 
            message: 'CSV data imported successfully from functions directory' 
          });
        }
      } catch (err) {
        console.warn('Could not import from functions directory:', err);
      }
      
      return res.status(400).json({ error: 'No CSV data provided' });
    } catch (error) {
      console.error('Error in POST /api/import-csv:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    // Only allow POST requests
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}