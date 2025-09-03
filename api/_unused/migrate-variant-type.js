import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Adding variant_type column to model_variants table...');

    // Add variant_type column to existing table
    const alterTableSql = `
      ALTER TABLE model_variants 
      ADD COLUMN IF NOT EXISTS variant_type VARCHAR(20) DEFAULT 'upload';
    `;

    const { error } = await supabase.rpc('exec_sql', { sql: alterTableSql });

    if (error) {
      console.error('Error adding column:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to add variant_type column',
        details: error.message,
        instructions: 'Run this SQL manually in your Supabase SQL editor:',
        sql: alterTableSql
      });
    }

    console.log('✅ variant_type column added successfully!');

    return res.status(200).json({
      success: true,
      message: 'variant_type column added to model_variants table!',
      sql: alterTableSql
    });

  } catch (error) {
    console.error('💥 Migration error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      instructions: 'Run this SQL manually in your Supabase SQL editor:',
      manualSql: 'ALTER TABLE model_variants ADD COLUMN IF NOT EXISTS variant_type VARCHAR(20) DEFAULT \'upload\';'
    });
  }
}