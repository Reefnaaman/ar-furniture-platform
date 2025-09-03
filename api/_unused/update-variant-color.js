/**
 * Update variant dominant color in database
 * Called after color extraction from rendered GLB model
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { variantId, dominantColor } = req.body;
    
    if (!variantId || !dominantColor) {
      return res.status(400).json({ error: 'Variant ID and dominant color are required' });
    }

    // Import supabase functions
    const { supabase } = await import('../lib/supabase.js');

    // Update the variant's hex_color field
    const { data, error } = await supabase
      .from('model_variants')
      .update({ hex_color: dominantColor })
      .eq('id', variantId)
      .select();

    if (error) {
      console.error('Supabase update variant color error:', error);
      return res.status(500).json({ 
        error: 'Failed to update variant color in database',
        details: error.message 
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    console.log('✅ Updated variant color:', variantId, 'to:', dominantColor);
    
    res.status(200).json({
      success: true,
      variantId: variantId,
      dominantColor: dominantColor,
      message: 'Variant color updated successfully'
    });

  } catch (error) {
    console.error('Error updating variant color:', error);
    res.status(500).json({ 
      error: 'Failed to update variant color',
      details: error.message 
    });
  }
}