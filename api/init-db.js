import { initDatabase } from '../lib/database.js';

/**
 * Initialize database tables
 * GET /api/init-db
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const result = await initDatabase();
    
    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: 'Database initialized successfully!' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}