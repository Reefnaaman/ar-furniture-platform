import { createClient } from '@supabase/supabase-js';

/**
 * Test Supabase connection
 * GET /api/db-test
 */
export default async function handler(req, res) {
  try {
    // Test importing Supabase
    console.log('Testing Supabase connection...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test connection with a simple query
    const { data, error } = await supabase
      .from('models')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    
    console.log('Supabase connection successful!');
    
    res.status(200).json({
      success: true,
      message: 'Supabase connection working!',
      env_check: {
        supabase_url: !!process.env.SUPABASE_URL,
        supabase_anon_key: !!process.env.SUPABASE_ANON_KEY
      },
      table_accessible: true
    });
    
  } catch (error) {
    console.error('Supabase test error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      env_vars_present: {
        supabase_url: !!process.env.SUPABASE_URL,
        supabase_anon_key: !!process.env.SUPABASE_ANON_KEY
      }
    });
  }
}