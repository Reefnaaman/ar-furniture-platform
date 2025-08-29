import { getAllModels, getStats, deleteModel } from '../lib/database.js';
import { deleteModel as deleteFromCloudinary } from '../lib/cloudinary.js';

/**
 * Handle models API
 * GET /api/models - List all models
 * DELETE /api/models - Delete a model
 */
export default async function handler(req, res) {
  // List all models
  if (req.method === 'GET') {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      
      const models = await getAllModels(limit, offset);
      const stats = await getStats();
      
      res.status(200).json({
        models,
        stats,
        success: true
      });
      
    } catch (error) {
      console.error('Error fetching models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
  }
  
  // Delete a model
  else if (req.method === 'DELETE') {
    // Check admin password
    const password = req.headers['x-admin-password'];
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { id, cloudinaryPublicId } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Model ID required' });
    }
    
    try {
      // Delete from Cloudinary if public ID provided
      if (cloudinaryPublicId) {
        await deleteFromCloudinary(cloudinaryPublicId);
      }
      
      // Delete from database
      const result = await deleteModel(id);
      
      if (!result.success) {
        throw new Error('Failed to delete from database');
      }
      
      res.status(200).json({ success: true, message: 'Model deleted successfully' });
      
    } catch (error) {
      console.error('Error deleting model:', error);
      res.status(500).json({ error: 'Failed to delete model' });
    }
  }
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}