import { uploadModel } from '../lib/cloudinary.js';
import { saveModelVariant, getModelVariants, deleteModelVariant, setPrimaryVariant } from '../lib/supabase.js';
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
 * Handle model variants API
 * GET: Get variants for a model
 * POST: Create new variant
 * DELETE: Delete variant
 * PUT: Update variant (set primary)
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { method, query, body } = req;
    const { modelId } = query;

    switch (method) {
      case 'GET':
        return await handleGetVariants(req, res, modelId);
      case 'POST':
        return await handleCreateVariant(req, res, modelId);
      case 'DELETE':
        return await handleDeleteVariant(req, res, body);
      case 'PUT':
        return await handleUpdateVariant(req, res, body);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Variants API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

/**
 * Get variants for a model
 */
async function handleGetVariants(req, res, modelId) {
  if (!modelId) {
    return res.status(400).json({ error: 'Model ID is required' });
  }

  try {
    const variants = await getModelVariants(modelId);
    res.status(200).json({ variants, success: true });
  } catch (error) {
    console.error('Error fetching variants:', error);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
}

/**
 * Create new variant
 */
async function handleCreateVariant(req, res, modelId) {
  if (!modelId) {
    return res.status(400).json({ error: 'Model ID is required' });
  }

  try {
    // Get parent model data first
    const { getModel } = await import('../lib/supabase.js');
    const parentModel = await getModel(modelId);
    
    if (!parentModel) {
      return res.status(404).json({ error: 'Parent model not found' });
    }

    // Parse multipart form data
    const form = new multiparty.Form();
    
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // Get variant data
    const uploadedFile = files.file?.[0];
    const variantName = fields.variantName?.[0];
    const hexColor = fields.hexColor?.[0];
    const variantType = fields.variantType?.[0] || 'upload';
    const isPrimary = fields.isPrimary?.[0] === 'true';

    if (!variantName || !hexColor) {
      return res.status(400).json({ error: 'Variant name and color are required' });
    }

    let cloudinaryResult;
    
    if (variantType === 'upload' && uploadedFile) {
      // Validate file type if new file provided
      if (!uploadedFile.originalFilename?.match(/\.(glb|gltf)$/i)) {
        return res.status(400).json({ error: 'Only GLB and GLTF files are allowed' });
      }

      // Check file size (100MB)
      if (uploadedFile.size > 100 * 1024 * 1024) {
        return res.status(400).json({ error: 'File too large. Maximum size is 100MB' });
      }

      // Read and upload new file
      const fs = await import('fs');
      const fileBuffer = fs.readFileSync(uploadedFile.path);
      const cloudinaryFileName = `${modelId}_${variantName.toLowerCase().replace(/\s+/g, '_')}_${uploadedFile.originalFilename}`;
      cloudinaryResult = await uploadModel(fileBuffer, cloudinaryFileName);
      
      // Clean up temp file
      fs.unlinkSync(uploadedFile.path);
    } else {
      // Use parent model's Cloudinary data for color-only variants
      cloudinaryResult = {
        url: parentModel.cloudinary_url,
        publicId: parentModel.cloudinary_public_id,
        size: parentModel.file_size
      };
    }

    // Save variant to database
    const variantResult = await saveModelVariant({
      parentModelId: modelId,
      variantName,
      hexColor,
      cloudinaryUrl: cloudinaryResult.url,
      cloudinaryPublicId: cloudinaryResult.publicId,
      fileSize: cloudinaryResult.size,
      isPrimary,
      variantType
    });

    if (!variantResult.success) {
      return res.status(500).json({ 
        error: 'Failed to save variant to database',
        details: variantResult.error
      });
    }

    res.status(200).json({
      success: true,
      variant: variantResult.data,
      message: `Variant "${variantName}" created successfully!`
    });

  } catch (error) {
    console.error('Create variant error:', error);
    return res.status(500).json({ 
      error: 'Failed to create variant', 
      details: error.message
    });
  }
}

/**
 * Delete variant
 */
async function handleDeleteVariant(req, res, body) {
  const { variantId, cloudinaryPublicId } = body;
  
  if (!variantId) {
    return res.status(400).json({ error: 'Variant ID required' });
  }
  
  try {
    // Delete from Cloudinary if public ID provided
    if (cloudinaryPublicId) {
      await deleteFromCloudinary(cloudinaryPublicId);
    }
    
    // Delete from database
    const result = await deleteModelVariant(variantId);
    
    if (!result.success) {
      throw new Error('Failed to delete variant from database');
    }
    
    res.status(200).json({ success: true, message: 'Variant deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting variant:', error);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
}

/**
 * Update variant (set primary)
 */
async function handleUpdateVariant(req, res, body) {
  const { modelId, variantId, action } = body;
  
  if (!modelId || !variantId || !action) {
    return res.status(400).json({ error: 'Model ID, variant ID, and action are required' });
  }
  
  try {
    if (action === 'setPrimary') {
      const result = await setPrimaryVariant(modelId, variantId);
      
      if (!result.success) {
        throw new Error('Failed to set primary variant');
      }
      
      res.status(200).json({ success: true, message: 'Primary variant updated successfully' });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
    
  } catch (error) {
    console.error('Error updating variant:', error);
    res.status(500).json({ error: 'Failed to update variant' });
  }
}