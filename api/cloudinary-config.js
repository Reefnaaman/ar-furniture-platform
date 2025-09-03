/**
 * Cloudinary Configuration API
 * Returns public configuration for direct browser uploads
 * This allows bypassing Vercel's 4.5MB serverless function limit
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Return Cloudinary configuration for client-side uploads
    // We use unsigned uploads with an upload preset for security
    res.status(200).json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      uploadPreset: 'ar-furniture-unsigned', // You'll need to create this in Cloudinary dashboard
      apiKey: process.env.CLOUDINARY_API_KEY, // Public API key (safe to expose)
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedFormats: ['glb', 'gltf']
    });
  } catch (error) {
    console.error('Error fetching Cloudinary config:', error);
    res.status(500).json({ 
      error: 'Failed to fetch configuration',
      details: error.message 
    });
  }
}