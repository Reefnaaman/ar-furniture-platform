import { getModel, incrementViewCount } from '../../lib/database.js';

/**
 * Get model by ID
 * GET /api/model/[id]
 */
export default async function handler(req, res) {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Model ID required' });
  }
  
  try {
    // Get model from database
    const model = await getModel(id);
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Redirect to Cloudinary URL for the actual file
    res.redirect(302, model.cloudinary_url);
    
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
}