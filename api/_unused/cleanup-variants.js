import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧹 Cleaning up color-type variants...');

    // Delete all variants where variant_type is 'color'
    const { data: deletedVariants, error: deleteError } = await supabase
      .from('model_variants')
      .delete()
      .eq('variant_type', 'color')
      .select();

    if (deleteError) {
      console.error('Error deleting color variants:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete color variants',
        details: deleteError.message
      });
    }

    console.log(`✅ Deleted ${deletedVariants?.length || 0} color-type variants`);

    // Get remaining variants for summary
    const { data: remainingVariants, error: countError } = await supabase
      .from('model_variants')
      .select('variant_type, count', { count: 'exact' });

    return res.status(200).json({
      success: true,
      message: `Cleaned up ${deletedVariants?.length || 0} color-type variants`,
      deletedCount: deletedVariants?.length || 0,
      remainingVariants: remainingVariants?.length || 0,
      deletedVariants: deletedVariants || []
    });

  } catch (error) {
    console.error('💥 Cleanup error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      instructions: 'Run this SQL manually in your Supabase SQL editor:',
      manualSql: "DELETE FROM model_variants WHERE variant_type = 'color';"
    });
  }
}