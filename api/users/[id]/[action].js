import { query } from '../../../lib/supabase.js';
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
    const { id: userId, action } = req.query; // Vercel provides this automatically for [id]/[action] structure
    
    console.log('User route debug:', { 
      url: req.url, 
      userId,
      action,
      method: req.method,
      query: req.query
    });
    
    if (req.method === 'PUT' && userId && action) {
      
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
    
    console.log('No route matched:', { method: req.method, userId, action });
    return res.status(404).json({ 
      error: 'Route not found',
      debug: { method: req.method, userId, action, url: req.url }
    });
    
  } catch (error) {
    console.error('Error in user route API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}