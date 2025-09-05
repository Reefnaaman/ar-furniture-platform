import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // PUT /api/models - Update model details
  if (req.method === 'PUT') {
    try {
      const { modelId, id, title, description } = req.body;
      const actualModelId = modelId || id; // Accept both formats
      
      if (!actualModelId) {
        return res.status(400).json({ error: 'Model ID is required' });
      }
      
      // Build update object
      const updateData = { updated_at: new Date().toISOString() };
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      
      const { data, error } = await supabase
        .from('models')
        .update(updateData)
        .eq('id', actualModelId)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating model:', error);
        return res.status(500).json({ error: 'Failed to update model' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Model updated successfully',
        model: data
      });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // GET /api/models - Get all models (existing functionality from main API)
  else if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching models:', error);
        return res.status(500).json({ error: 'Failed to fetch models' });
      }
      
      return res.status(200).json({
        success: true,
        models: data || []
      });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}