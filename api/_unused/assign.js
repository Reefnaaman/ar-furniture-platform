import { updateModelCustomer } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { modelId, customerId, customerName } = req.body;
    
    if (!modelId || !customerId || !customerName) {
      return res.status(400).json({ error: 'Model ID, Customer ID and name required' });
    }
    
    const result = await updateModelCustomer(modelId, customerId, customerName);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(200).json({ 
      success: true, 
      model: result.data,
      message: 'Model assigned successfully' 
    });
    
  } catch (error) {
    console.error('Error assigning model:', error);
    res.status(500).json({ error: 'Failed to assign model' });
  }
}