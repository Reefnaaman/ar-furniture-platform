import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🎨 Initializing images table...');

    // Create images table
    const { error: createError } = await supabase.rpc('exec_sql', {
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
          image_type VARCHAR(50) NOT NULL, -- 'logo', 'brand', 'customer_logo', etc.
          customer_id VARCHAR(100),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Add index for faster queries
        CREATE INDEX IF NOT EXISTS idx_images_type ON images(image_type);
        CREATE INDEX IF NOT EXISTS idx_images_customer ON images(customer_id);
      `
    });

    if (createError) {
      console.error('Failed to create images table:', createError);
      return res.status(500).json({
        error: 'Failed to create images table',
        details: createError.message,
        solution: 'Run the SQL manually in Supabase SQL editor'
      });
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