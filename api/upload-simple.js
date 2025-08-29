import { uploadModel } from '../lib/cloudinary.js';
import { saveModel, initDatabase } from '../lib/database.js';
import multiparty from 'multiparty';

export const config = {
  api: {
    bodyParser: false
  }
};

/**
 * Simple upload handler using multiparty
 * POST /api/upload-simple
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize database
    await initDatabase();
    
    // Parse form using multiparty
    const form = new multiparty.Form();
    
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // Get file
    const uploadedFile = files.file?.[0];
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Validate file type
    if (!uploadedFile.originalFilename?.match(/\.(glb|gltf)$/i)) {
      return res.status(400).json({ error: 'Only GLB and GLTF files are allowed' });
    }

    // Check file size (100MB)
    if (uploadedFile.size > 100 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB' });
    }

    // Read file
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(uploadedFile.path);

    // Upload to Cloudinary
    console.log('Uploading to Cloudinary...');
    const cloudinaryResult = await uploadModel(fileBuffer, uploadedFile.originalFilename);

    // Save to database
    console.log('Saving to database...');
    const dbResult = await saveModel({
      title: fields.title?.[0] || uploadedFile.originalFilename.replace(/\.(glb|gltf)$/i, ''),
      description: fields.description?.[0] || '',
      filename: uploadedFile.originalFilename,
      cloudinaryUrl: cloudinaryResult.url,
      cloudinaryPublicId: cloudinaryResult.publicId,
      fileSize: cloudinaryResult.size,
      metadata: {
        mimetype: uploadedFile.headers['content-type'],
        uploadedAt: new Date().toISOString()
      }
    });

    if (!dbResult.success) {
      return res.status(500).json({ error: 'Failed to save model to database' });
    }

    // Clean up temp file
    fs.unlinkSync(uploadedFile.path);

    // Return success
    const modelId = dbResult.id;
    const domain = process.env.DOMAIN || 'newfurniture.live';
    
    res.status(200).json({
      success: true,
      id: modelId,
      viewUrl: `https://${domain}/view?id=${modelId}`,
      directUrl: cloudinaryResult.url,
      shareUrl: `https://${domain}/view?id=${modelId}`,
      title: fields.title?.[0] || uploadedFile.originalFilename,
      fileSize: cloudinaryResult.size,
      message: 'Model uploaded successfully!'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Upload failed', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}