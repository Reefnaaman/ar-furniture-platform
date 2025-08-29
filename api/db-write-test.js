import { createClient } from '@supabase/supabase-js';

/**
 * Test writing to Supabase database
 * GET /api/db-write-test
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try to insert a test record
    const testData = {
      id: 'test123',
      title: 'Test Model',
      description: 'Test Description',
      filename: 'test.glb',
      cloudinary_url: 'https://test.com/test.glb',
      cloudinary_public_id: 'test/test123',
      file_size: 1000,
      metadata: { test: true }
    };
    
    const { data, error } = await supabase
      .from('models')
      .insert([testData])
      .select();
    
    if (error) throw error;
    
    // Clean up - delete the test record
    await supabase
      .from('models')  
      .delete()
      .eq('id', 'test123');
    
    res.status(200).json({
      success: true,
      message: 'Database write test successful!',
      data: data
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null
    });
  }
}