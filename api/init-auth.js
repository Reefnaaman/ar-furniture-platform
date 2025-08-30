import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('Creating authentication tables...');
    
    // Create users table
    const { error: usersError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(10) PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'customer',
          customer_id VARCHAR(255),
          customer_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        );
      `
    });
    
    // Create sessions table
    const { error: sessionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_sessions (
          session_id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL
        );
      `
    });
    
    if (usersError) {
      console.error('Users table creation error:', usersError);
    }
    
    if (sessionsError) {
      console.error('Sessions table creation error:', sessionsError);
    }
    
    // Create default admin user if it doesn't exist
    const adminPassword = process.env.ADMIN_PASSWORD || 'FurnitechMVP';
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    
    const { nanoid } = await import('nanoid');
    const adminId = nanoid(8);
    
    const { error: adminError } = await supabase
      .from('users')
      .upsert([
        {
          id: adminId,
          username: 'admin',
          password_hash: hashedPassword,
          role: 'admin',
          customer_id: null,
          customer_name: 'Administrator'
        }
      ], { onConflict: 'username' });
    
    if (adminError) {
      console.error('Admin user creation error:', adminError);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Authentication system initialized',
      instructions: [
        '1. Users table created with role-based permissions',
        '2. Sessions table created for secure authentication',
        '3. Default admin user created (username: admin)',
        '4. Use /api/create-user to add customer accounts',
        '5. Use /api/login for authentication'
      ],
      nextSteps: [
        'Create customer accounts for each client',
        'Implement login page',
        'Add session middleware to protect routes'
      ]
    });
    
  } catch (error) {
    console.error('Auth initialization error:', error);
    return res.status(500).json({ 
      error: 'Failed to initialize authentication', 
      details: error.message 
    });
  }
}