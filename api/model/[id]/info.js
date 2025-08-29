import { getModel } from '../../../lib/database.js';

/**
 * Get model info
 * GET /api/model/[id]/info
 */
export default async function handler(req, res) {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Model ID required' });
  }
  
  try {
    const model = await getModel(id);
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Return model info without the Cloudinary URL (for security)
    res.status(200).json({
      id: model.id,
      title: model.title,
      description: model.description,
      filename: model.filename,
      file_size: model.file_size,
      upload_date: model.upload_date,
      view_count: model.view_count,
      metadata: model.metadata
    });
    
  } catch (error) {
    console.error('Error fetching model info:', error);
    res.status(500).json({ error: 'Failed to fetch model info' });
  }
}