import { getModelsByCustomer } from '../lib/supabase.js';

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
    // Get customer ID from query parameter
    const customerId = req.query.customer || req.query.id;
    
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    console.log(`Fetching models for customer: ${customerId}`);

    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const models = await getModelsByCustomer(customerId, limit, offset);
    
    console.log(`Found ${models.length} models for customer ${customerId}:`, models);
    
    // Get customer stats
    const totalViews = models.reduce((sum, model) => sum + (model.view_count || 0), 0);
    const totalSize = models.reduce((sum, model) => sum + (model.file_size || 0), 0);
    
    const stats = {
      totalModels: models.length,
      totalViews,
      totalSize
    };
    
    res.status(200).json({
      models,
      stats,
      customer: customerId,
      success: true
    });
    
  } catch (error) {
    console.error('Error fetching customer models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customer models',
      details: error.message 
    });
  }
}