/**
 * Ultra-simple test - no imports
 * GET /api/simple-test
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    res.status(200).json({
      success: true,
      message: 'Simple test works',
      method: req.method
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}