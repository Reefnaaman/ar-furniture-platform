import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Use service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  // Only allow GET requests for safety
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Initializing model_variants table...');

    // Create model_variants table
    const createVariantsTable = `
      CREATE TABLE IF NOT EXISTS model_variants (
        id TEXT PRIMARY KEY,
        parent_model_id TEXT NOT NULL,
        variant_name VARCHAR(100) NOT NULL,
        hex_color VARCHAR(7) NOT NULL,
        cloudinary_url TEXT NOT NULL,
        cloudinary_public_id TEXT NOT NULL,
        file_size BIGINT,
        is_primary BOOLEAN DEFAULT false,
        variant_type VARCHAR(20) DEFAULT 'upload',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_model_id) REFERENCES models(id) ON DELETE CASCADE
      );
    `;

    // Create indexes for better performance
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_variants_parent_model ON model_variants(parent_model_id);',
      'CREATE INDEX IF NOT EXISTS idx_variants_primary ON model_variants(parent_model_id, is_primary);',
    ];

    // Execute table creation
    const { error: tableError } = await supabase.rpc('exec_sql', { 
      sql: createVariantsTable 
    });

    if (tableError) {
      console.error('Error creating table:', tableError);
      // Fallback: try using direct SQL if RPC doesn't work
      const { error: directError } = await supabase
        .from('_temp') // This might not work, but we'll handle it gracefully
        .select('*')
        .limit(0);
    }

    // Try to create indexes
    for (const indexSql of createIndexes) {
      try {
        await supabase.rpc('exec_sql', { sql: indexSql });
      } catch (indexError) {
        console.log('Index creation skipped (may already exist):', indexError.message);
      }
    }

    // Test the table by trying to query it
    const { data: testQuery, error: testError } = await supabase
      .from('model_variants')
      .select('*')
      .limit(0);

    if (testError) {
      console.error('Table test failed:', testError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create or access model_variants table',
        details: testError.message,
        instructions: 'You may need to create the table manually in your Supabase SQL editor',
        sql: createVariantsTable
      });
    }

    console.log('✅ model_variants table ready!');

    return res.status(200).json({
      success: true,
      message: 'Model variants database initialized successfully!',
      table: 'model_variants',
      schema: {
        id: 'TEXT PRIMARY KEY',
        parent_model_id: 'TEXT NOT NULL (FK to models.id)',
        variant_name: 'VARCHAR(100) NOT NULL',
        hex_color: 'VARCHAR(7) NOT NULL',
        cloudinary_url: 'TEXT NOT NULL',
        cloudinary_public_id: 'TEXT NOT NULL',
        file_size: 'BIGINT',
        is_primary: 'BOOLEAN DEFAULT false',
        created_at: 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP'
      }
    });

  } catch (error) {
    console.error('💥 Database initialization error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      manualSql: `
-- Run this SQL manually in Supabase SQL Editor if automatic creation fails:

CREATE TABLE IF NOT EXISTS model_variants (
  id TEXT PRIMARY KEY,
  parent_model_id TEXT NOT NULL,
  variant_name VARCHAR(100) NOT NULL,
  hex_color VARCHAR(7) NOT NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  file_size BIGINT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_model_id) REFERENCES models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_variants_parent_model ON model_variants(parent_model_id);
CREATE INDEX IF NOT EXISTS idx_variants_primary ON model_variants(parent_model_id, is_primary);
      `
    });
  }
}