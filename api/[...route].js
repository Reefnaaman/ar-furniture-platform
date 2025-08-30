import { uploadModel } from '../lib/cloudinary.js';
import { saveModel, getModel, getAllModels, getModelsByCustomer, getCustomers, getStats, deleteModel, incrementViewCount, updateModelCustomer } from '../lib/supabase.js';
import { deleteModel as deleteFromCloudinary } from '../lib/cloudinary.js';
import multiparty from 'multiparty';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

/**
 * Single catch-all API handler for all routes
 * Handles: upload, models, model/[id], model/[id]/info, model/[id]/view
 */
export default async function handler(req, res) {
  console.log('=== FUNCTION ENTRY ===');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Parse route from URL path instead of query params
    const url = new URL(req.url, `https://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean); // ['api', 'upload-simple'] or ['api', 'models']
    const routePath = pathParts.slice(1).join('/'); // Remove 'api' prefix: 'upload-simple' or 'models'
    
    // Debug logging
    console.log('Route debug:', { 
      url: req.url, 
      pathname: url.pathname, 
      pathParts, 
      routePath, 
      method: req.method 
    });
    
    // Additional debug for model routes
    if (routePath?.startsWith('model/')) {
      const routeParts = routePath.split('/');
      console.log('Model route debug:', {
        routePath,
        routeParts,
        modelId: routeParts[1],
        action: routeParts[2],
        partsLength: routeParts.length
      });
    }
    
    // Route: /api/upload-simple
    if (routePath === 'upload-simple') {
      return await handleUpload(req, res);
    }
    
    // Route: /api/models
    if (routePath === 'models') {
      return await handleModels(req, res);
    }
    
    // Route: /api/customers
    if (routePath === 'customers') {
      return await handleCustomers(req, res);
    }
    
    // Route: /api/customer/[id]
    if (routePath?.startsWith('customer/')) {
      const customerId = routePath.split('/')[1];
      return await handleCustomerModels(req, res, customerId);
    }
    
    // Route: /api/model/[id]
    if (routePath?.startsWith('model/')) {
      const routeParts = routePath.split('/');
      const modelId = routeParts[1];
      
      if (routeParts.length === 2) {
        // /api/model/[id]
        return await handleModelFile(req, res, modelId);
      } else if (routeParts.length === 3 && routeParts[2] === 'info') {
        // /api/model/[id]/info
        return await handleModelInfo(req, res, modelId);
      } else if (routeParts.length === 3 && routeParts[2] === 'view') {
        // /api/model/[id]/view
        return await handleModelView(req, res, modelId);
      } else if (routeParts.length === 3 && routeParts[2] === 'assign') {
        // /api/model/[id]/assign
        return await handleModelAssign(req, res, modelId);
      }
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
      customerId: fields.customerId?.[0] || 'unassigned',
      customerName: fields.customerName?.[0] || 'Unassigned',
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

/**
 * Handle customers list
 */
async function handleCustomers(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const customers = await getCustomers();
    res.status(200).json({ customers, success: true });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
}

/**
 * Handle customer-specific models
 */
async function handleCustomerModels(req, res, customerId) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const models = await getModelsByCustomer(customerId, limit, offset);
    
    // Get customer stats
    const totalViews = models.reduce((sum, model) => sum + (model.view_count || 0), 0);
    const totalSize = models.reduce((sum, model) => sum + (model.file_size || 0), 0);
    
    const stats = {
      totalModels: models.length,
      totalViews,
      totalSize
    };
    
    res.status(200).json({
      models,
      stats,
      customer: customerId,
      success: true
    });
    
  } catch (error) {
    console.error('Error fetching customer models:', error);
    res.status(500).json({ error: 'Failed to fetch customer models' });
  }
}

/**
 * Handle model customer assignment
 */
async function handleModelAssign(req, res, modelId) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { customerId, customerName } = req.body;
    
    if (!customerId || !customerName) {
      return res.status(400).json({ error: 'Customer ID and name required' });
    }
    
    const result = await updateModelCustomer(modelId, customerId, customerName);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(200).json({ 
      success: true, 
      model: result.data,
      message: 'Model assigned successfully' 
    });
    
  } catch (error) {
    console.error('Error assigning model:', error);
    res.status(500).json({ error: 'Failed to assign model' });
  }
}