import { migrateCustomersToUsers } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('Starting customer to user migration...');
    const result = await migrateCustomersToUsers();
    
    if (result.success) {
      return res.status(200).json({ 
        success: true, 
        message: `Successfully migrated ${result.migratedCount} customers to users`,
        migratedCount: result.migratedCount
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
    
  } catch (error) {
    console.error('Migration API error:', error);
    res.status(500).json({ error: 'Migration failed' });
  }
}