/**
 * Cloudinary Configuration API
 * Returns public configuration for direct browser uploads
 * This allows bypassing Vercel's 4.5MB serverless function limit
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      // Return Cloudinary configuration for client-side uploads
      // We DON'T use unsigned uploads - we'll generate a signature
      res.status(200).json({
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
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
  } else if (req.method === 'POST') {
    // Generate a signature for signed uploads
    try {
      const { v2: cloudinary } = await import('cloudinary');
      
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      const timestamp = Math.round(new Date().getTime() / 1000);
      const { uploadType, filename } = req.body;
      
      // Generate proper folder and public_id
      const folder = 'furniture-models';
      const publicId = `${folder}/${Date.now()}-${filename || 'model.glb'}`;
      
      const params = {
        timestamp: timestamp,
        folder: folder,
        public_id: publicId,
        resource_type: 'raw',
        type: 'upload',
        overwrite: true
      };

      // Generate signature
      const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

      res.status(200).json({
        signature,
        timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
        params
      });
    } catch (error) {
      console.error('Error generating signature:', error);
      res.status(500).json({ 
        error: 'Failed to generate upload signature',
        details: error.message 
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}