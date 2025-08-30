import { getModel, incrementViewCount } from '../lib/supabase.js';

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
    
    console.log('Fetching model file for ID:', id);
    
    const model = await getModel(id);
    
    if (!model) {
      console.log('Model not found in database:', id);
      return res.status(404).json({ error: 'Model not found' });
    }
    
    console.log('Model found, redirecting to Cloudinary URL');
    
    // Increment view count
    await incrementViewCount(id);
    
    // Redirect to Cloudinary URL for the actual file
    res.redirect(302, model.cloudinary_url);
    
  } catch (error) {
    console.error('Error fetching model file:', error);
    res.status(500).json({ error: 'Failed to fetch model file' });
  }
}