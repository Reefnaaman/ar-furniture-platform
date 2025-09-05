import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧹 Cleaning up customer_requests table...');

    // Delete all requests
    const { error } = await supabase
      .from('customer_requests')
      .delete()
      .neq('id', 'never_matches'); // This will match all rows

    if (error) {
      console.error('Error deleting requests:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to clean requests',
        details: error.message
      });
    }

    console.log('✅ All requests cleaned successfully');

    return res.status(200).json({
      success: true,
      message: 'All customer requests have been cleaned from the database'
    });

  } catch (error) {
    console.error('💥 Cleanup error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}