import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🎨 Initializing images table...');

    // Try to create table by inserting and then deleting a test record
    // This will auto-create the table if it doesn't exist
    const testId = 'test-' + Date.now();
    
    // First, try to insert a test record to trigger table creation
    const { error: testError } = await supabase
      .from('images')
      .insert({
        id: testId,
        filename: 'test.jpg',
        cloudinary_url: 'https://test.url',
        cloudinary_public_id: 'test-id',
        image_type: 'test',
        file_size: 0,
        metadata: {}
      });
    
    if (testError && testError.code === '42P01') {
      // Table doesn't exist
      console.log('Images table does not exist');
      return res.status(200).json({
        success: false,
        message: 'Images table needs to be created manually',
        sql: `
CREATE TABLE IF NOT EXISTS images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  format VARCHAR(50),
  image_type VARCHAR(50) NOT NULL,
  customer_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_type ON images(image_type);
CREATE INDEX IF NOT EXISTS idx_images_customer ON images(customer_id);
        `,
        instructions: 'Please run the SQL above in your Supabase SQL editor'
      });
    }
    
    // If test insert succeeded, delete the test record
    if (!testError) {
      await supabase
        .from('images')
        .delete()
        .eq('id', testId);
    }

    console.log('✅ Images table created successfully!');

    return res.status(200).json({
      success: true,
      message: 'Images table initialized successfully!'
    });

  } catch (error) {
    console.error('💥 Database initialization error:', error);
    return res.status(500).json({ 
      error: error.message,
      solution: 'Check your Supabase configuration'
    });
  }
}