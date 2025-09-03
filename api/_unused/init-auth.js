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
    
    // Check if tables exist by trying to select from them
    let tablesExist = false;
    try {
      const { data: testUsers } = await supabase.from('users').select('id').limit(1);
      const { data: testSessions } = await supabase.from('user_sessions').select('session_id').limit(1);
      tablesExist = true;
      console.log('Tables already exist');
    } catch (error) {
      console.log('Tables do not exist, need to create manually');
      tablesExist = false;
    }
    
    if (!tablesExist) {
      return res.status(200).json({
        success: false,
        message: 'Tables need to be created manually in Supabase',
        instructions: [
          '1. Go to your Supabase dashboard → SQL Editor',
          '2. Run this SQL to create the users table:',
          '',
          'CREATE TABLE users (',
          '  id VARCHAR(10) PRIMARY KEY,',
          '  username VARCHAR(50) UNIQUE NOT NULL,',
          '  password_hash VARCHAR(255) NOT NULL,',
          '  role VARCHAR(20) NOT NULL DEFAULT \'customer\',',
          '  customer_id VARCHAR(255),',
          '  customer_name VARCHAR(255),',
          '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
          '  is_active BOOLEAN DEFAULT true',
          ');',
          '',
          '3. Run this SQL to create the sessions table:',
          '',
          'CREATE TABLE user_sessions (',
          '  session_id VARCHAR(255) PRIMARY KEY,',
          '  user_id VARCHAR(10) NOT NULL,',
          '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
          '  expires_at TIMESTAMP NOT NULL',
          ');',
          '',
          '4. After creating tables, visit this endpoint again to create the admin user'
        ]
      });
    }
    
    // Tables exist, create default admin user if it doesn't exist
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'admin')
      .single();
    
    if (!existingAdmin) {
      const adminPassword = process.env.ADMIN_PASSWORD || 'FurnitechMVP';
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const { nanoid } = await import('nanoid');
      const adminId = nanoid(8);
      
      const { error: adminError } = await supabase
        .from('users')
        .insert([
          {
            id: adminId,
            username: 'admin',
            password_hash: hashedPassword,
            role: 'admin',
            customer_id: null,
            customer_name: 'Administrator'
          }
        ]);
      
      if (adminError) {
        console.error('Admin user creation error:', adminError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create admin user',
          details: adminError.message
        });
      }
      
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
    
    return res.status(200).json({
      success: true,
      message: 'Authentication system initialized successfully',
      details: {
        tablesExist: true,
        adminUserCreated: !existingAdmin,
        adminUsername: 'admin',
        adminPassword: process.env.ADMIN_PASSWORD || 'FurnitechMVP'
      },
      instructions: [
        '1. Authentication system is ready',
        '2. Admin login: username="admin", password="' + (process.env.ADMIN_PASSWORD || 'FurnitechMVP') + '"',
        '3. Use /api/create-user to add customer accounts',
        '4. Use /api/login for authentication'
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