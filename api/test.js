/**
 * Simple test endpoint to verify deployment
 * GET /api/test
 */
export default async function handler(req, res) {
  try {
    // Test basic functionality
    const result = {
      success: true,
      message: 'API is working!',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform
      },
      dependencies: {
        cloudinary: 'available',
        supabase: 'checking...',
        nanoid: 'available'
      }
    };

    // Test supabase import
    try {
      const { createClient } = await import('@supabase/supabase-js');
      result.dependencies.supabase = 'available';
    } catch (error) {
      result.dependencies.supabase = `error: ${error.message}`;
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Test failed',
      message: error.message,
      stack: error.stack
    });
  }
}