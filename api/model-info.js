import { getModel, supabase } from '../lib/supabase.js';

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
    // Get model ID from query parameter
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Model ID required' });
    }
    
    console.log('Fetching model info for ID:', id);
    
    const model = await getModel(id);
    
    if (!model) {
      console.log('Model not found in database:', id);
      return res.status(404).json({ error: 'Model not found' });
    }
    
    console.log('Model found:', model.title);
    
    // Get variants for this model
    const { data: variants, error: variantsError } = await supabase
      .from('model_variants')
      .select('*')
      .eq('parent_model_id', id)
      .order('is_primary', { ascending: false });

    if (variantsError) {
      console.warn('Error fetching variants for model info:', variantsError);
    }

    console.log('Variants found:', variants?.length || 0);
    
    // Return model info with variants
    res.status(200).json({
      id: model.id,
      title: model.title,
      description: model.description,
      filename: model.filename,
      file_size: model.file_size,
      upload_date: model.upload_date,
      view_count: model.view_count,
      dominant_color: model.dominant_color,
      metadata: model.metadata,
      variants: (variants || []).map(variant => ({
        id: variant.id,
        variant_name: variant.variant_name,
        hex_color: variant.hex_color,
        is_primary: variant.is_primary,
        variant_type: variant.variant_type || 'upload',
        cloudinary_url: variant.cloudinary_url // Include for variant switching
      }))
    });
    
  } catch (error) {
    console.error('Error fetching model info:', error);
    res.status(500).json({ error: 'Failed to fetch model info' });
  }
}