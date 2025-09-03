export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  return res.status(200).json({
    success: true,
    message: 'Database migration instructions',
    instructions: [
      '1. Go to your Supabase dashboard',
      '2. Navigate to the SQL Editor', 
      '3. Run this SQL to add missing columns:',
      '',
      'ALTER TABLE models ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255) DEFAULT \'unassigned\';',
      'ALTER TABLE models ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) DEFAULT \'Unassigned\';',
      '',
      '4. Update existing records:',
      'UPDATE models SET customer_id = \'unassigned\', customer_name = \'Unassigned\' WHERE customer_id IS NULL;',
      '',
      '5. Refresh your schema cache if needed'
    ],
    supabaseDashboard: 'https://supabase.com/dashboard'
  });
}