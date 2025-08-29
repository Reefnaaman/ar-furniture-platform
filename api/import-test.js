/**
 * Test imports one by one
 * GET /api/import-test
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const result = { success: true, imports: {} };
    
    // Test cloudinary import
    try {
      await import('../lib/cloudinary.js');
      result.imports.cloudinary = 'ok';
    } catch (error) {
      result.imports.cloudinary = `error: ${error.message}`;
    }
    
    // Test supabase import
    try {
      await import('../lib/supabase.js');
      result.imports.supabase = 'ok';
    } catch (error) {
      result.imports.supabase = `error: ${error.message}`;
    }
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}