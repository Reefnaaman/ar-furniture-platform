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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { username, password, role = 'customer', customerId, customerName } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (role === 'customer' && (!customerId || !customerName)) {
      return res.status(400).json({ error: 'Customer ID and name are required for customer role' });
    }
    
    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();
    
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Generate user ID
    const { nanoid } = await import('nanoid');
    const userId = nanoid(8);
    
    // Create user
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          username,
          password_hash: hashedPassword,
          role,
          customer_id: role === 'customer' ? customerId : null,
          customer_name: role === 'customer' ? customerName : username
        }
      ])
      .select();
    
    if (error) {
      throw error;
    }
    
    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: data[0].id,
        username: data[0].username,
        role: data[0].role,
        customerId: data[0].customer_id,
        customerName: data[0].customer_name
      }
    });
    
  } catch (error) {
    console.error('User creation error:', error);
    return res.status(500).json({ 
      error: 'Failed to create user', 
      details: error.message 
    });
  }
}