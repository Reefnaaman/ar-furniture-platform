import { query } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('Base users route debug:', { 
      url: req.url, 
      method: req.method 
    });
    
    if (req.method === 'GET') {
      // GET /api/users - List all users with view counts
      const usersResult = await query(`
        SELECT 
          u.id,
          u.username,
          u.role,
          u.customer_id,
          u.customer_name,
          u.is_active,
          u.created_at,
          COALESCE(SUM(m.view_count), 0) as total_views
        FROM users u
        LEFT JOIN models m ON (u.role = 'customer' AND m.customer_id = u.customer_id)
        GROUP BY u.id, u.username, u.role, u.customer_id, u.customer_name, u.is_active, u.created_at
        ORDER BY u.created_at DESC
      `);
      
      if (!usersResult.success) {
        return res.status(500).json({ error: 'Failed to fetch users' });
      }
      
      return res.status(200).json(usersResult.data || []);
    }
    
    return res.status(405).json({ error: 'Method not allowed. Use /api/users/[id]/[action] for user operations.' });
    
  } catch (error) {
    console.error('Error in base users API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}