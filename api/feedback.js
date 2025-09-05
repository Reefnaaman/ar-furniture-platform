import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET /api/feedback - Get feedback (admin or filtered)
  if (req.method === 'GET') {
    try {
      const { customer, type, model } = req.query;
      
      let query = supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Apply filters if provided
      if (customer) {
        query = query.eq('customer_id', customer);
      }
      if (type) {
        query = query.eq('feedback_type', type);
      }
      if (model) {
        query = query.eq('model_id', model);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching feedback:', error);
        return res.status(500).json({ error: 'Failed to fetch feedback' });
      }
      
      return res.status(200).json({
        feedback: data || [],
        success: true
      });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // POST /api/feedback - Submit new feedback
  else if (req.method === 'POST') {
    try {
      const { type, categories, comment, customerId, itemId, itemName } = req.body;
      
      if (!type || !customerId || !itemId) {
        return res.status(400).json({ error: 'Missing required fields: type, customerId, itemId' });
      }
      
      // Generate feedback ID
      const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          id: feedbackId,
          feedback_type: type,
          categories: categories || [],
          comment: comment || null,
          customer_id: customerId,
          model_id: itemId,
          model_name: itemName || '',
          user_agent: req.headers['user-agent'] || '',
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving feedback:', error);
        return res.status(500).json({ error: 'Failed to save feedback' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully',
        feedbackId: feedbackId
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