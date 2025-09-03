import { query } from '../lib/supabase.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Parse URL to extract user operations
    const url = new URL(req.url, `https://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const pathSegments = pathParts.slice(2); // Remove 'api' and 'users'
    
    console.log('Users API debug:', { 
      url: req.url, 
      pathname: url.pathname,
      pathParts,
      pathSegments,
      method: req.method 
    });
    
    if (req.method === 'GET' && pathSegments.length === 0) {
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
    
    if (req.method === 'PUT' && pathSegments.length === 2) {
      const userId = pathSegments[0];
      const action = pathSegments[1];
      
      console.log('PUT request debug:', { userId, action });
      
      if (action === 'password') {
        // PUT /api/users/{id}/password - Update user password
        const { password } = req.body;
        
        if (!password) {
          return res.status(400).json({ error: 'Password is required' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const updateResult = await query(
          'UPDATE users SET password_hash = $1 WHERE id = $2',
          [hashedPassword, userId]
        );
        
        if (!updateResult.success) {
          return res.status(500).json({ error: 'Failed to update password' });
        }
        
        return res.status(200).json({ success: true });
      }
      
      if (action === 'toggle') {
        // PUT /api/users/{id}/toggle - Toggle user active status
        const toggleResult = await query(
          'UPDATE users SET is_active = NOT is_active WHERE id = $1',
          [userId]
        );
        
        if (!toggleResult.success) {
          return res.status(500).json({ error: 'Failed to toggle user status' });
        }
        
        return res.status(200).json({ success: true });
      }
    }
    
    console.log('No route matched:', { method: req.method, pathSegments });
    return res.status(404).json({ 
      error: 'Route not found',
      debug: { method: req.method, pathSegments, url: req.url }
    });
    
  } catch (error) {
    console.error('Error in base users API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}