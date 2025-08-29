import { uploadModel } from '../lib/cloudinary.js';
import { saveModel, getModel, getAllModels, getStats, deleteModel, incrementViewCount } from '../lib/supabase.js';
import { deleteModel as deleteFromCloudinary } from '../lib/cloudinary.js';
import multiparty from 'multiparty';

export const config = {
  api: {
    bodyParser: false
  }
};

/**
 * Single catch-all API handler for all routes
 * Handles: upload, models, model/[id], model/[id]/info, model/[id]/view
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { route } = req.query;
    const routePath = Array.isArray(route) ? route.join('/') : route;
    
    // Debug logging
    console.log('Route debug:', { route, routePath, method: req.method });
    
    // Route: /api/upload-simple
    if (routePath === 'upload-simple') {
      return await handleUpload(req, res);
    }
    
    // Route: /api/models
    if (routePath === 'models') {
      return await handleModels(req, res);
    }
    
    // Route: /api/model/[id]
    if (routePath?.startsWith('model/') && routePath.split('/').length === 2) {
      const modelId = routePath.split('/')[1];
      return await handleModelFile(req, res, modelId);
    }
    
    // Route: /api/model/[id]/info
    if (routePath?.startsWith('model/') && routePath.endsWith('/info')) {
      const modelId = routePath.split('/')[1];
      return await handleModelInfo(req, res, modelId);
    }
    
    // Route: /api/model/[id]/view
    if (routePath?.startsWith('model/') && routePath.endsWith('/view')) {
      const modelId = routePath.split('/')[1];
      return await handleModelView(req, res, modelId);
    }
    
    // 404 for unknown routes
    return res.status(404).json({ error: 'Route not found' });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

/**
 * Handle file upload
 */
async function handleUpload(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
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
    console.log('Data to save:', {
      title: fields.title?.[0] || uploadedFile.originalFilename.replace(/\.(glb|gltf)$/i, ''),
      description: fields.description?.[0] || '',
      filename: uploadedFile.originalFilename,
      cloudinaryUrl: cloudinaryResult.url,
      cloudinaryPublicId: cloudinaryResult.publicId,
      fileSize: cloudinaryResult.size
    });
    
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

    console.log('Database save result:', dbResult);

    if (!dbResult.success) {
      console.error('Database save failed:', dbResult.error);
      return res.status(500).json({ 
        error: 'Failed to save model to database',
        details: dbResult.error || 'Unknown database error'
      });
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
      details: error.message
    });
  }
}

/**
 * Handle models listing and deletion
 */
async function handleModels(req, res) {
  // List all models
  if (req.method === 'GET') {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      
      const models = await getAllModels(limit, offset);
      const stats = await getStats();
      
      res.status(200).json({
        models,
        stats,
        success: true
      });
      
    } catch (error) {
      console.error('Error fetching models:', error);
      res.status(500).json({ error: 'Failed to fetch models' });
    }
  }
  
  // Delete a model
  else if (req.method === 'DELETE') {
    // Check admin password
    const password = req.headers['x-admin-password'];
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { id, cloudinaryPublicId } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Model ID required' });
    }
    
    try {
      // Delete from Cloudinary if public ID provided
      if (cloudinaryPublicId) {
        await deleteFromCloudinary(cloudinaryPublicId);
      }
      
      // Delete from database
      const result = await deleteModel(id);
      
      if (!result.success) {
        throw new Error('Failed to delete from database');
      }
      
      res.status(200).json({ success: true, message: 'Model deleted successfully' });
      
    } catch (error) {
      console.error('Error deleting model:', error);
      res.status(500).json({ error: 'Failed to delete model' });
    }
  }
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle model file serving
 */
async function handleModelFile(req, res, modelId) {
  try {
    // Get model from database
    const model = await getModel(modelId);
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Redirect to Cloudinary URL for the actual file
    res.redirect(302, model.cloudinary_url);
    
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
}

/**
 * Handle model info
 */
async function handleModelInfo(req, res, modelId) {
  try {
    const model = await getModel(modelId);
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Return model info without the Cloudinary URL (for security)
    res.status(200).json({
      id: model.id,
      title: model.title,
      description: model.description,
      filename: model.filename,
      file_size: model.file_size,
      upload_date: model.upload_date,
      view_count: model.view_count,
      metadata: model.metadata
    });
    
  } catch (error) {
    console.error('Error fetching model info:', error);
    res.status(500).json({ error: 'Failed to fetch model info' });
  }
}

/**
 * Handle model view tracking
 */
async function handleModelView(req, res, modelId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const result = await incrementViewCount(modelId);
    
    if (!result.success) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
}