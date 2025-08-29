/**
 * Simple upload test endpoint
 * GET /api/upload-test
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Test imports
    const { uploadModel } = await import('../lib/cloudinary.js');
    const { saveModel } = await import('../lib/supabase.js');
    
    res.status(200).json({
      success: true,
      message: 'Upload endpoint is accessible',
      method: req.method,
      imports: {
        cloudinary: 'ok',
        supabase: 'ok'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}