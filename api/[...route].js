import { uploadModel } from '../lib/cloudinary.js';
import { saveModel, getModel, getAllModels, getModelsWithVariants, getModelsByCustomer, getModelsByCustomerWithVariants, getCustomers, getStats, deleteModel, incrementViewCount, updateModelCustomer, saveModelVariant, supabase, query } from '../lib/supabase.js';
import { deleteModel as deleteFromCloudinary } from '../lib/cloudinary.js';
import { getInternalEndpoint } from '../lib/endpoints.js';
import { convertGLBToUSDZ } from '../lib/usdz-converter.js';
import multiparty from 'multiparty';
import bcrypt from 'bcryptjs';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb'
    }
  }
};

/**
 * Single catch-all API handler for all routes
 * Handles: upload, models, model/[id], model/[id]/info, model/[id]/view, upload-variant
 */
export default async function handler(req, res) {
  console.log('=== FUNCTION ENTRY v2.0 ===', new Date().toISOString());
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('User-Agent:', req.headers['user-agent']);
  
  // Log all requests that include 'users' for debugging
  if (req.url?.includes('users')) {
    console.log('🔍 USERS REQUEST DETECTED:', {
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
  
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
    const pathParts = url.pathname.split('/').filter(Boolean); // ['api', 's7'] or ['api', 'models']
    const externalRoutePath = pathParts.slice(1).join('/'); // Remove 'api' prefix: 's7' or 'models'
    
    // Convert obfuscated endpoint back to internal name
    const routePath = getInternalEndpoint(externalRoutePath) || externalRoutePath;
    
    // Debug logging
    console.log('Route debug:', { 
      url: req.url, 
      pathname: url.pathname, 
      pathParts,
      externalRoutePath,
      routePath, 
      method: req.method 
    });
    
    // Additional debug for users routes specifically
    if (routePath?.includes('users')) {
      console.log('USERS ROUTE DEBUG:', { routePath, startsWithUsers: routePath?.startsWith('users/'), equalsUsers: routePath === 'users' });
    }
    
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

    // Route: /api/cloudinary-config - Get signed upload configuration
    if (routePath === 'cloudinary-config') {
      return await handleCloudinaryConfig(req, res);
    }

    // Route: /api/cloudinary-save - Save metadata after direct upload
    if (routePath === 'cloudinary-save') {
      return await handleCloudinarySave(req, res);
    }

    // Route: /api/models
    if (routePath === 'models') {
      return await handleModels(req, res);
    }
    
    // Route: /api/customers
    if (routePath === 'customers') {
      return await handleCustomers(req, res);
    }
    
    // Route: /api/cleanup-variants
    if (routePath === 'cleanup-variants') {
      return await handleCleanupVariants(req, res);
    }
    
    // Route: /api/update-color
    if (routePath === 'update-color') {
      return await handleUpdateColor(req, res);
    }
    
    // Route: /api/upload-image
    if (routePath === 'upload-image') {
      return await handleImageUpload(req, res);
    }
    
    // Route: /api/images
    if (routePath === 'images') {
      return await handleImages(req, res);
    }
    
    // Route: /api/create-images-table
    if (routePath === 'create-images-table') {
      return await handleCreateImagesTable(req, res);
    }
    
    // Route: /api/create-requests-table
    if (routePath === 'create-requests-table') {
      return await handleCreateRequestsTable(req, res);
    }
    
    // Route: /api/create-brand-settings-table
    if (routePath === 'create-brand-settings-table') {
      return await handleCreateBrandSettingsTable(req, res);
    }
    
    // Route: /api/create-variants-table
    if (routePath === 'create-variants-table') {
      return await handleCreateVariantsTable(req, res);
    }
    
    // Route: /api/requests - Customer furniture requests
    if (routePath === 'requests') {
      return await handleRequests(req, res);
    }
    
    // Route: /api/init-models-db
    if (routePath === 'init-models-db') {
      return await handleInitModelsDB(req, res);
    }
    
    // Route: /api/test-save-model
    if (routePath === 'test-save-model') {
      return await handleTestSaveModel(req, res);
    }
    
    // Route: /api/test-brand-settings-schema
    if (routePath === 'test-brand-settings-schema') {
      return await handleTestBrandSettingsSchema(req, res);
    }
    
    // Route: /api/create-user
    if (routePath === 'create-user') {
      return await handleCreateUser(req, res);
    }
    
    // Route: /api/users - handle all user operations directly
    if (routePath === 'users') {
      // GET /api/users - List all users with view counts
      if (req.method === 'GET') {
        const usersResult = await query(`
          SELECT 
            u.id,
            u.username,
            u.role,
            u.customer_id,
            u.customer_name,
            u.is_active,
            u.created_at,
            COALESCE(SUM(m.view_count), 0) as total_views
          FROM users u
          LEFT JOIN models m ON (u.role = 'customer' AND m.customer_id = u.customer_id)
          GROUP BY u.id, u.username, u.role, u.customer_id, u.customer_name, u.is_active, u.created_at
          ORDER BY u.created_at DESC
        `);
        
        if (!usersResult.success) {
          return res.status(500).json({ error: 'Failed to fetch users' });
        }
        
        return res.status(200).json(usersResult.data || []);
      }
      
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Route: /api/users/{id}/password - Update user password
    if (routePath?.startsWith('users/') && routePath.endsWith('/password')) {
      if (req.method === 'PUT') {
        const userId = routePath.split('/')[1];
        const { password } = req.body;
        
        if (!password) {
          return res.status(400).json({ error: 'Password is required' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const updateResult = await query(
          'UPDATE users SET password_hash = $1 WHERE id = $2',
          [hashedPassword, userId]
        );
        
        if (!updateResult.success) {
          return res.status(500).json({ error: 'Failed to update password' });
        }
        
        return res.status(200).json({ success: true });
      }
      
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Route: /api/users/{id}/toggle - Toggle user active status  
    if (routePath?.startsWith('users/') && routePath.endsWith('/toggle')) {
      if (req.method === 'PUT') {
        const userId = routePath.split('/')[1];
        
        const toggleResult = await query(
          'UPDATE users SET is_active = NOT is_active WHERE id = $1',
          [userId]
        );
        
        if (!toggleResult.success) {
          return res.status(500).json({ error: 'Failed to toggle user status' });
        }
        
        return res.status(200).json({ success: true });
      }
      
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Route: /api/customers/[id]/brand-settings
    if (routePath?.match(/^customers\/[^\/]+\/brand-settings$/)) {
      const customerId = routePath.split('/')[1];
      return await handleCustomerBrandSettings(req, res, customerId);
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
      } else if (routeParts.length === 3 && routeParts[2] === 'usdz') {
        // /api/model/[id]/usdz
        return await handleModelUSDZ(req, res, modelId);
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
 * Handle file upload (models and variants)
 */
async function handleUpload(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data with increased limits
    const form = new multiparty.Form({
      maxFilesSize: 100 * 1024 * 1024, // 100MB
      maxFields: 20,
      maxFieldsSize: 2 * 1024 * 1024  // 2MB for form fields
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // Check if this is a variant upload (has parentModelId field)
    const parentModelId = fields.parentModelId?.[0];
    const variantName = fields.variantName?.[0];
    
    // More robust variant detection - check for non-empty strings
    const isVariantUpload = parentModelId && variantName && 
                           parentModelId.trim() !== '' && variantName.trim() !== '';
    
    // Debug log the form fields to see what we're receiving
    console.log('📋 Form fields received:', Object.keys(fields).map(key => `${key}: ${fields[key]?.[0] || 'undefined'}`));
    console.log('📋 All form fields structure:', JSON.stringify(fields, null, 2));
    console.log('📋 Variant upload detection:', { 
      parentModelId, 
      variantName, 
      parentModelIdTrimmed: parentModelId?.trim(), 
      variantNameTrimmed: variantName?.trim(),
      parentModelIdEmpty: !parentModelId || parentModelId.trim() === '',
      variantNameEmpty: !variantName || variantName.trim() === '',
      isVariantUpload 
    });
    console.log('📋 Upload path decision:', isVariantUpload ? '🎨 VARIANT UPLOAD PATH' : '📦 REGULAR MODEL UPLOAD PATH');

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

    let dbResult;
    
    if (isVariantUpload) {
      // Handle variant upload
      console.log('Saving variant to database...');
      const hexColor = fields.hexColor?.[0] || '#000000';
      
      dbResult = await saveModelVariant({
        parentModelId: parentModelId,
        variantName: variantName,
        hexColor: hexColor,
        cloudinaryUrl: cloudinaryResult.url,
        cloudinaryPublicId: cloudinaryResult.publicId,
        fileSize: cloudinaryResult.size,
        isPrimary: false,
        variantType: 'upload'
      });
    } else {
      // Handle regular model upload
      console.log('Saving model to database...');
      console.log('Data to save:', {
        title: fields.title?.[0] || uploadedFile.originalFilename.replace(/\.(glb|gltf)$/i, ''),
        description: fields.description?.[0] || '',
        filename: uploadedFile.originalFilename,
        cloudinaryUrl: cloudinaryResult.url,
        cloudinaryPublicId: cloudinaryResult.publicId,
        fileSize: cloudinaryResult.size
      });
      
      // Parse dimensions if provided
      let dimensions = null;
      if (fields.dimensions?.[0]) {
        try {
          dimensions = JSON.parse(fields.dimensions[0]);
          console.log('📏 Parsed dimensions:', dimensions);
        } catch (error) {
          console.warn('⚠️ Failed to parse dimensions, skipping:', error.message);
        }
      }
      
      dbResult = await saveModel({
      title: fields.title?.[0] || uploadedFile.originalFilename.replace(/\.(glb|gltf)$/i, ''),
      description: fields.description?.[0] || '',
      filename: uploadedFile.originalFilename,
      cloudinaryUrl: cloudinaryResult.url,
      cloudinaryPublicId: cloudinaryResult.publicId,
      fileSize: cloudinaryResult.size,
      customerId: fields.customerId?.[0] || 'unassigned',
      customerName: fields.customerName?.[0] || 'Unassigned',
      productUrl: fields.product_url?.[0] || null,
      dominantColor: '#6b7280', // Will be updated by frontend after color extraction
      dimensions: dimensions,
      metadata: {
        mimetype: uploadedFile.headers['content-type'],
        uploadedAt: new Date().toISOString()
      }
    });
    }

    console.log('Database save result:', dbResult);

    if (!dbResult.success) {
      console.error('Database save failed:', dbResult.error);
      const errorType = isVariantUpload ? 'variant' : 'model';
      return res.status(500).json({ 
        error: `Failed to save ${errorType} to database`,
        details: dbResult.error || 'Unknown database error'
      });
    }

    // Clean up temp file
    fs.unlinkSync(uploadedFile.path);

    // Return success - different response based on upload type
    const domain = process.env.DOMAIN || 'newfurniture.live';
    
    if (isVariantUpload) {
      // Variant upload response
      res.status(200).json({
        success: true,
        id: dbResult.id,
        parentModelId: parentModelId,
        variantName: variantName,
        hexColor: fields.hexColor?.[0] || '#000000',
        cloudinaryUrl: cloudinaryResult.url,
        viewUrl: `https://${domain}/view?id=${parentModelId}&variant=${dbResult.id}`,
        message: 'Variant uploaded successfully!',
        debugInfo: {
          uploadType: 'variant',
          formFields: Object.keys(fields).map(key => `${key}: ${fields[key]?.[0] || 'undefined'}`),
          detectedAs: 'variant'
        }
      });
    } else {
      // Model upload response
      const modelId = dbResult.id;
      res.status(200).json({
        success: true,
        id: modelId,
        viewUrl: `https://${domain}/view?id=${modelId}`,
        directUrl: cloudinaryResult.url,
        shareUrl: `https://${domain}/view?id=${modelId}`,
        title: fields.title?.[0] || uploadedFile.originalFilename,
        fileSize: cloudinaryResult.size,
        message: 'Model uploaded successfully!',
        debugInfo: {
          uploadType: 'model',
          formFields: Object.keys(fields).map(key => `${key}: ${fields[key]?.[0] || 'undefined'}`),
          detectedAs: 'regular model',
          variantDetectionResult: { parentModelId, variantName, isVariantUpload }
        }
      });
    }

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
      
      const models = await getModelsWithVariants(limit, offset);
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
  
  // Update a model
  else if (req.method === 'PUT') {
    const { modelId, id, title, description } = req.body;
    const actualModelId = modelId || id; // Accept both formats
    
    if (!actualModelId) {
      return res.status(400).json({ error: 'Model ID is required' });
    }
    
    try {
      // Build update object
      const updateData = { updated_at: new Date().toISOString() };
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      
      const { data, error } = await supabase
        .from('models')
        .update(updateData)
        .eq('id', actualModelId)
        .select()
        .single();

      if (error) {
        console.error('Error updating model:', error);
        return res.status(500).json({ error: 'Failed to update model' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Model updated successfully',
        model: data
      });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Delete a model or variant
  else if (req.method === 'DELETE') {
    const { id, cloudinaryPublicId, type } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'ID required' });
    }
    
    try {
      if (type === 'variant') {
        // Delete variant
        console.log('Deleting variant:', id);
        
        // Get variant info first to delete from Cloudinary
        const { data: variant, error: fetchError } = await supabase
          .from('model_variants')
          .select('cloudinary_public_id')
          .eq('id', id)
          .single();
          
        if (fetchError) {
          console.warn('Could not fetch variant for cleanup:', fetchError);
        }
        
        // Delete from Cloudinary if public ID available
        if (variant?.cloudinary_public_id) {
          await deleteFromCloudinary(variant.cloudinary_public_id);
        }
        
        // Delete from database
        const { error: deleteError } = await supabase
          .from('model_variants')
          .delete()
          .eq('id', id);
          
        if (deleteError) {
          throw new Error('Failed to delete variant from database');
        }
        
        res.status(200).json({ success: true, message: 'Variant deleted successfully' });
        
      } else {
        // Delete model (original logic)
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
      }
      
    } catch (error) {
      console.error('Error deleting:', error);
      res.status(500).json({ error: `Failed to delete ${type || 'model'}` });
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
 * Handle model info with variants
 */
async function handleModelInfo(req, res, modelId) {
  try {
    const model = await getModel(modelId);
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Get variants for this model
    const { data: variants, error: variantsError } = await supabase
      .from('model_variants')
      .select('*')
      .eq('parent_model_id', modelId)
      .order('is_primary', { ascending: false });

    if (variantsError) {
      console.warn('Error fetching variants for model info:', variantsError);
    }
    
    // Return model info with variants (without Cloudinary URLs for security)
    res.status(200).json({
      id: model.id,
      title: model.title,
      description: model.description,
      filename: model.filename,
      file_size: model.file_size,
      upload_date: model.upload_date,
      view_count: model.view_count,
      dominant_color: model.dominant_color,
      customer_id: model.customer_id, // Include for logo loading
      customer_name: model.customer_name, // Include for logo loading
      metadata: model.metadata,
      // Include dimension data for AR scaling
      width_meters: model.width_meters,
      height_meters: model.height_meters,
      depth_meters: model.depth_meters,
      dimension_unit: model.dimension_unit,
      variants: (variants || []).map(variant => ({
        id: variant.id,
        variant_name: variant.variant_name,
        hex_color: variant.hex_color,
        is_primary: variant.is_primary,
        variant_type: variant.variant_type || 'upload',
        cloudinary_url: variant.cloudinary_url // Include for variant switching
      }))
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
    
    const models = await getModelsByCustomerWithVariants(customerId, limit, offset);
    
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

/**
 * Handle cleanup of color-type variants
 */
async function handleCleanupVariants(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧹 Cleaning up color-type variants...');

    // Delete all variants where variant_type is 'color'
    const { data: deletedVariants, error: deleteError } = await supabase
      .from('model_variants')
      .delete()
      .eq('variant_type', 'color')
      .select();

    if (deleteError) {
      console.error('Error deleting color variants:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete color variants',
        details: deleteError.message
      });
    }

    console.log(`✅ Deleted ${deletedVariants?.length || 0} color-type variants`);

    // Get remaining variants for summary
    const { data: remainingVariants, error: countError } = await supabase
      .from('model_variants')
      .select('*');

    return res.status(200).json({
      success: true,
      message: `Cleaned up ${deletedVariants?.length || 0} color-type variants`,
      deletedCount: deletedVariants?.length || 0,
      remainingVariants: remainingVariants?.length || 0,
      deletedVariants: deletedVariants || []
    });

  } catch (error) {
    console.error('💥 Cleanup error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      instructions: 'Run this SQL manually in your Supabase SQL editor:',
      manualSql: "DELETE FROM model_variants WHERE variant_type = 'color';"
    });
  }
}

/**
 * Handle updating dominant color for a model
 */
async function handleUpdateColor(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { modelId, dominantColor } = req.body;
    
    if (!modelId || !dominantColor) {
      return res.status(400).json({ error: 'Model ID and dominant color required' });
    }
    
    // Validate hex color format
    if (!/^#[0-9A-Fa-f]{6}$/.test(dominantColor)) {
      return res.status(400).json({ error: 'Invalid hex color format' });
    }

    // Update model dominant color in database
    const { error } = await supabase
      .from('models')
      .update({ dominant_color: dominantColor })
      .eq('id', modelId);

    if (error) {
      console.error('Error updating model color:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update model color',
        details: error.message
      });
    }
    
    console.log(`✅ Updated dominant color for model ${modelId}: ${dominantColor}`);

    return res.status(200).json({
      success: true,
      message: 'Model color updated successfully',
      modelId,
      dominantColor
    });

  } catch (error) {
    console.error('💥 Update color error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}

/**
 * Validate image access permissions
 */
async function validateImageAccess(req, imageType, customerId) {
  if (imageType === 'customer_logo') {
    const authHeader = req.headers['x-admin-password'];
    
    if (authHeader === process.env.ADMIN_PASSWORD) {
      return { authorized: true, role: 'admin' };
    }
    
    // For now, only admins can manage customer logos
    // TODO: Add customer session validation when customer auth is implemented
    return { authorized: false, error: 'Unauthorized: Customer logos require admin access' };
  }
  
  return { authorized: true };
}

/**
 * Validate and normalize customer ID
 */
async function validateCustomerId(customerId) {
  if (!customerId) return { valid: false, error: 'Customer ID required for customer logos' };
  
  const normalizedId = customerId.toLowerCase().trim();
  
  // Check if customer exists in models table
  const { data, error } = await supabase
    .from('models')
    .select('customer_id')
    .ilike('customer_id', normalizedId)
    .limit(1);
    
  if (error || !data || data.length === 0) {
    return { valid: false, error: `Customer '${normalizedId}' not found in system` };
  }
  
  return { valid: true, normalizedId };
}

/**
 * Enforce one logo per customer by cleaning up existing logos
 */
async function enforceOneLogoPerCustomer(customerId) {
  const { data: existingLogos } = await supabase
    .from('images')
    .select('id, cloudinary_public_id')
    .eq('image_type', 'customer_logo')
    .ilike('customer_id', customerId);
    
  if (existingLogos && existingLogos.length > 0) {
    console.log(`🧹 Replacing ${existingLogos.length} existing logo(s) for customer: ${customerId}`);
    
    // Delete from Cloudinary first
    const { deleteImage } = await import('../lib/cloudinary.js');
    for (const logo of existingLogos) {
      try {
        await deleteImage(logo.cloudinary_public_id);
      } catch (e) {
        console.warn('Failed to delete old logo from Cloudinary:', e.message);
      }
    }
    
    // Delete from database
    await supabase
      .from('images')
      .delete()
      .eq('image_type', 'customer_logo')
      .ilike('customer_id', customerId);
  }
}

/**
 * Standardize image types to prevent variations
 */
const ALLOWED_IMAGE_TYPES = {
  'customer_logo': 'customer_logo',
  'Customer_logo': 'customer_logo',
  'CUSTOMER_LOGO': 'customer_logo',
  'general': 'general',
  'brand_asset': 'brand_asset'
};

function normalizeImageType(rawType) {
  const normalized = ALLOWED_IMAGE_TYPES[rawType || 'general'];
  if (!normalized) {
    throw new Error(`Invalid image type: ${rawType}. Allowed: ${Object.keys(ALLOWED_IMAGE_TYPES).join(', ')}`);
  }
  return normalized;
}

/**
 * Handle image upload (logos, brand assets, etc.)
 */
async function handleImageUpload(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data with increased limits
    const form = new multiparty.Form({
      maxFilesSize: 100 * 1024 * 1024, // 100MB
      maxFields: 20,
      maxFieldsSize: 2 * 1024 * 1024  // 2MB for form fields
    });

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
    if (!uploadedFile.originalFilename?.match(/\.(jpg|jpeg|png|webp|svg)$/i)) {
      return res.status(400).json({ error: 'Only image files (JPG, PNG, WebP, SVG) are allowed' });
    }

    // Check file size (10MB for images)
    if (uploadedFile.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB' });
    }

    // Read file
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(uploadedFile.path);

    // Upload to Cloudinary
    console.log('Uploading image to Cloudinary...');
    const { uploadImage } = await import('../lib/cloudinary.js');
    const cloudinaryResult = await uploadImage(fileBuffer, uploadedFile.originalFilename);

    // Validate and normalize input data
    console.log('Validating image upload data...');
    const rawImageType = fields.imageType?.[0] || 'general';
    const rawCustomerId = fields.customerId?.[0] || null;
    const customerName = fields.customerName?.[0] || null;
    
    // Normalize and validate image type
    const imageType = normalizeImageType(rawImageType);
    
    // Validate permissions for this image type
    const accessCheck = await validateImageAccess(req, imageType, rawCustomerId);
    if (!accessCheck.authorized) {
      return res.status(403).json({ error: accessCheck.error });
    }
    
    let customerId = rawCustomerId;
    
    // For customer logos, validate customer ID and normalize it
    if (imageType === 'customer_logo') {
      const customerValidation = await validateCustomerId(rawCustomerId);
      if (!customerValidation.valid) {
        return res.status(400).json({ error: customerValidation.error });
      }
      customerId = customerValidation.normalizedId;
      
      // Enforce one logo per customer
      await enforceOneLogoPerCustomer(customerId);
    }
    
    console.log('Saving image to database...');
    
    // Generate a UUID for the image
    const imageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const { data, error } = await supabase
      .from('images')
      .insert({
        id: imageId,
        filename: uploadedFile.originalFilename,
        cloudinary_url: cloudinaryResult.url,
        cloudinary_public_id: cloudinaryResult.publicId,
        file_size: cloudinaryResult.size,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
        format: cloudinaryResult.format,
        image_type: imageType,
        customer_id: customerId,
        metadata: {
          originalName: uploadedFile.originalFilename,
          uploadedAt: new Date().toISOString(),
          customerName: customerName
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to save image to database' });
    }

    // Clean up temp file
    try {
      fs.unlinkSync(uploadedFile.path);
    } catch (e) {
      console.log('Could not delete temp file:', e);
    }

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      image: data
    });

  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Handle fetching all images or images by type
 */
async function handleImages(req, res) {
  if (req.method === 'GET') {
    try {
      const { imageType, customerId } = req.query;
      
      let query = supabase.from('images').select('*');
      
      if (imageType) {
        // Normalize image type for consistent searching
        const normalizedType = normalizeImageType(imageType);
        query = query.eq('image_type', normalizedType);
      }
      
      if (customerId) {
        // Use case-insensitive matching for customer ID
        query = query.ilike('customer_id', customerId.toLowerCase().trim());
      }
      
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching images:', error);
        return res.status(500).json({ error: 'Failed to fetch images' });
      }
      
      return res.status(200).json({ images: data || [] });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id, cloudinaryPublicId } = req.body;
      
      if (!id || !cloudinaryPublicId) {
        return res.status(400).json({ error: 'Image ID and Cloudinary ID required' });
      }
      
      // First, get the image to validate permissions
      const { data: image, error: fetchError } = await supabase
        .from('images')
        .select('*')
        .eq('id', id)
        .single();
        
      if (fetchError || !image) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      // Validate permissions for deletion
      const accessCheck = await validateImageAccess(req, image.image_type, image.customer_id);
      if (!accessCheck.authorized) {
        return res.status(403).json({ error: accessCheck.error });
      }
      
      console.log(`🗑️ Deleting ${image.image_type} image for customer: ${image.customer_id || 'general'}`);
      
      // Delete from Cloudinary
      const { deleteImage } = await import('../lib/cloudinary.js');
      await deleteImage(cloudinaryPublicId);
      
      // Delete from database
      const { error } = await supabase
        .from('images')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting image:', error);
        return res.status(500).json({ error: 'Failed to delete image' });
      }
      
      return res.status(200).json({ success: true, message: 'Image deleted successfully' });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle testing saveModel function
 */
async function handleTestSaveModel(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧪 Testing saveModel function...');
    
    const testResult = await saveModel({
      title: 'Test Model',
      description: 'Test Description',
      filename: 'test.glb',
      cloudinaryUrl: 'https://test.cloudinary.com/test.glb',
      cloudinaryPublicId: 'test-public-id',
      fileSize: 12345,
      customerId: 'test-customer',
      customerName: 'Test Customer',
      dominantColor: '#6b7280',
      metadata: { test: true }
    });
    
    console.log('🧪 Test result:', testResult);
    
    if (!testResult.success) {
      return res.status(500).json({ 
        error: 'SaveModel test failed',
        details: testResult.error
      });
    }
    
    // Clean up test record
    await supabase
      .from('models')
      .delete()
      .eq('id', testResult.id);
    
    return res.status(200).json({
      success: true,
      message: 'SaveModel test passed!',
      testId: testResult.id
    });

  } catch (error) {
    console.error('🧪 Test error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Handle initializing models database table
 */
async function handleInitModelsDB(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🎨 Checking models table...');

    // Try to insert and then delete a test record to check if table exists
    const testId = 'test-' + Date.now();
    
    const { error: testError } = await supabase
      .from('models')
      .insert({
        id: testId,
        title: 'test',
        filename: 'test.glb',
        cloudinary_url: 'https://test.url',
        cloudinary_public_id: 'test-id',
        file_size: 0,
        customer_id: 'test',
        customer_name: 'Test',
        metadata: {}
      });
    
    if (testError && testError.code === '42P01') {
      // Table doesn't exist
      console.log('Models table does not exist');
      return res.status(200).json({
        success: false,
        message: 'Models table needs to be created manually',
        sql: `
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  filename VARCHAR(255) NOT NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  file_size BIGINT DEFAULT 0,
  customer_id VARCHAR(100) DEFAULT 'unassigned',
  customer_name VARCHAR(255) DEFAULT 'Unassigned',
  view_count INTEGER DEFAULT 0,
  dominant_color VARCHAR(7) DEFAULT '#6b7280',
  metadata JSONB DEFAULT '{}',
  product_url TEXT,
  -- Real-world dimensions in meters (for AR scaling)
  width_meters DECIMAL(10,4),
  height_meters DECIMAL(10,4), 
  depth_meters DECIMAL(10,4),
  dimension_unit VARCHAR(10) DEFAULT 'cm',
  dimension_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_models_customer ON models(customer_id);
CREATE INDEX IF NOT EXISTS idx_models_created ON models(created_at);

-- Grant permissions
GRANT ALL ON models TO authenticated;
GRANT ALL ON models TO service_role;
        `,
        instructions: 'Please run the SQL above in your Supabase SQL editor'
      });
    }
    
    // If test insert succeeded, delete the test record
    if (!testError) {
      await supabase
        .from('models')
        .delete()
        .eq('id', testId);
    }

    console.log('✅ Models table exists and is accessible!');

    return res.status(200).json({
      success: true,
      message: 'Models table is ready!'
    });

  } catch (error) {
    console.error('💥 Database initialization error:', error);
    return res.status(500).json({ 
      error: error.message,
      solution: 'Check your Supabase configuration'
    });
  }
}

/**
 * Handle creating images table SQL instructions
 */
async function handleCreateImagesTable(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    message: 'Please run the following SQL in your Supabase SQL editor',
    sql: `
-- Create images table
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  format VARCHAR(50),
  image_type VARCHAR(50) NOT NULL DEFAULT 'general',
  customer_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_images_type ON images(image_type);
CREATE INDEX IF NOT EXISTS idx_images_customer ON images(customer_id);

-- Grant permissions
GRANT ALL ON images TO authenticated;
GRANT ALL ON images TO service_role;
    `,
    instructions: [
      '1. Go to your Supabase dashboard',
      '2. Navigate to SQL Editor',
      '3. Copy and paste the SQL above',
      '4. Click "Run" to create the table'
    ]
  });
}

/**
 * Handle user creation with universal customer integration
 */
async function handleCreateUser(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password, role, customerId, customerName } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password and role are required' });
    }

    if (role === 'customer' && (!customerId || !customerName)) {
      return res.status(400).json({ error: 'Customer ID and name are required for customer role' });
    }

    // Generate user ID
    const userId = Date.now().toString().slice(-8);
    
    // Create user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        username,
        password_hash: password, // In production, this should be hashed
        role,
        customer_id: customerId || null,
        customer_name: customerName || null
      })
      .select()
      .single();

    if (userError) {
      console.error('Error creating user:', userError);
      return res.status(500).json({ error: 'Failed to create user: ' + userError.message });
    }

    // If creating a customer, also ensure they exist in the customers system
    if (role === 'customer') {
      // Check if customer already exists in models table (via assignment)
      const { data: existingCustomers } = await supabase
        .from('models')
        .select('customer_id, customer_name')
        .eq('customer_id', customerId)
        .limit(1);

      // If customer doesn't exist in models, create a placeholder entry
      if (!existingCustomers || existingCustomers.length === 0) {
        console.log(`Creating customer entry for: ${customerName} (${customerId})`);
        // We'll let the customer appear when they first get furniture assigned
        // This ensures the customer system stays universal
      }
    }

    return res.status(200).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: userData.id,
        username: userData.username,
        role: userData.role,
        customerId: userData.customer_id,
        customerName: userData.customer_name
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Handle requests table creation instructions
 */
async function handleCreateRequestsTable(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    message: 'Please run the following SQL in your Supabase SQL editor to create the customer_requests table',
    sql: `
-- Create customer_requests table for the requests feature
CREATE TABLE IF NOT EXISTS customer_requests (
  id TEXT PRIMARY KEY,
  customer_id VARCHAR(100) NOT NULL,
  product_url TEXT NOT NULL,
  title VARCHAR(255),
  description TEXT,
  reference_images TEXT[], -- Array of Cloudinary image URLs
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high
  estimated_completion DATE,
  notes TEXT, -- Customer notes
  admin_notes TEXT, -- Admin-only notes
  model_id TEXT, -- References models(id) when completed
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_requests_customer ON customer_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON customer_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created ON customer_requests(created_at);

-- Grant permissions
GRANT ALL ON customer_requests TO authenticated;
GRANT ALL ON customer_requests TO service_role;
    `,
    instructions: [
      '1. Go to your Supabase dashboard',
      '2. Navigate to SQL Editor',
      '3. Copy and paste the SQL above',
      '4. Click "Run" to create the customer_requests table'
    ]
  });
}

/**
 * Handle customer requests CRUD operations
 */
async function handleRequests(req, res) {
  // GET /api/requests or /api/requests?customer={id} - Get all requests or customer requests
  if (req.method === 'GET') {
    try {
      const { customer } = req.query;
      
      let query = supabase
        .from('customer_requests')
        .select(`
          *,
          models!customer_requests_model_id_fkey(title, id)
        `)
        .order('created_at', { ascending: false });
      
      // If customer parameter is provided, filter by customer (for customer view)
      // If no customer parameter, return all requests (for admin view)
      if (customer) {
        query = query.eq('customer_id', customer);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching requests:', error);
        return res.status(500).json({ error: 'Failed to fetch requests' });
      }
      
      return res.status(200).json({
        requests: data || [],
        success: true
      });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // POST /api/requests - Submit new request
  else if (req.method === 'POST') {
    try {
      const { customerId, productUrl, title, description, notes, referenceImages } = req.body;
      
      if (!customerId || !productUrl) {
        return res.status(400).json({ error: 'Customer ID and product URL are required' });
      }
      
      // Generate request ID
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      
      const { data, error } = await supabase
        .from('customer_requests')
        .insert({
          id: requestId,
          customer_id: customerId,
          product_url: productUrl,
          title: title || 'Custom Furniture Request',
          description: description || '',
          notes: notes || '',
          reference_images: referenceImages || [],
          status: 'pending',
          priority: 'normal',
          metadata: {
            submitted_at: new Date().toISOString(),
            user_agent: req.headers['user-agent']
          }
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating request:', error);
        return res.status(500).json({ error: 'Failed to create request' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Request submitted successfully!',
        request: data
      });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // PUT /api/requests - Update request (admin only for now)
  else if (req.method === 'PUT') {
    try {
      const { id, status, adminNotes, estimatedCompletion, modelId } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Request ID required' });
      }
      
      const updateData = { updated_at: new Date().toISOString() };
      
      if (status) updateData.status = status;
      if (adminNotes) updateData.admin_notes = adminNotes;
      if (estimatedCompletion) updateData.estimated_completion = estimatedCompletion;
      if (modelId) updateData.model_id = modelId;
      
      const { data, error } = await supabase
        .from('customer_requests')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating request:', error);
        return res.status(500).json({ error: 'Failed to update request' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Request updated successfully',
        request: data
      });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle brand settings table creation instructions
 */
async function handleCreateBrandSettingsTable(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    message: 'Please run the following SQL in your Supabase SQL editor to create the customer_brand_settings table',
    sql: `
-- Create customer_brand_settings table for complete brand customization
CREATE TABLE IF NOT EXISTS customer_brand_settings (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(100) NOT NULL UNIQUE,
  text_direction VARCHAR(3) DEFAULT 'ltr', -- 'ltr' or 'rtl'
  logo_url VARCHAR(500), -- URL to customer's logo in Cloudinary
  primary_color VARCHAR(7) DEFAULT '#58a6ff', -- Hex color for primary brand color
  secondary_color VARCHAR(7) DEFAULT '#79c0ff', -- Hex color for secondary brand color  
  font_family VARCHAR(100) DEFAULT 'Inter', -- Font family name
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_brand_settings_customer ON customer_brand_settings(customer_id);

-- Grant permissions
GRANT ALL ON customer_brand_settings TO authenticated;
GRANT ALL ON customer_brand_settings TO service_role;

-- Add comments for documentation
COMMENT ON TABLE customer_brand_settings IS 'Stores complete brand customization settings for each customer';
COMMENT ON COLUMN customer_brand_settings.text_direction IS 'Text direction: ltr (Left-to-Right) or rtl (Right-to-Left)';
COMMENT ON COLUMN customer_brand_settings.logo_url IS 'URL to customer logo stored in Cloudinary';
COMMENT ON COLUMN customer_brand_settings.primary_color IS 'Primary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN customer_brand_settings.secondary_color IS 'Secondary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN customer_brand_settings.font_family IS 'Brand font family name (e.g., Inter, Arial, Roboto)';
    `,
    migration: `
-- If table already exists, add new columns (safe migration)
ALTER TABLE customer_brand_settings 
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) DEFAULT '#58a6ff',
  ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7) DEFAULT '#79c0ff',
  ADD COLUMN IF NOT EXISTS font_family VARCHAR(100) DEFAULT 'Inter';

-- Update comments
COMMENT ON TABLE customer_brand_settings IS 'Stores complete brand customization settings for each customer';
COMMENT ON COLUMN customer_brand_settings.logo_url IS 'URL to customer logo stored in Cloudinary';
COMMENT ON COLUMN customer_brand_settings.primary_color IS 'Primary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN customer_brand_settings.secondary_color IS 'Secondary brand color in hex format (#RRGGBB)';
COMMENT ON COLUMN customer_brand_settings.font_family IS 'Brand font family name (e.g., Inter, Arial, Roboto)';
    `,
    instructions: [
      '1. Go to your Supabase dashboard',
      '2. Navigate to SQL Editor',
      '3. If table does NOT exist: Copy and paste the "sql" above',
      '4. If table ALREADY exists: Copy and paste the "migration" above instead',
      '5. Click "Run" to create/update the customer_brand_settings table',
      '6. Test by visiting /api/customers/[customer-id]/brand-settings'
    ]
  });
}

/**
 * Handle customer brand settings CRUD operations
 */
async function handleCustomerBrandSettings(req, res, customerId) {
  console.log(`Brand settings request for customer: ${customerId}, method: ${req.method}`);
  
  if (req.method === 'GET') {
    // Get customer brand settings
    try {
      const { data, error } = await supabase
        .from('customer_brand_settings')
        .select('*')
        .eq('customer_id', customerId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching brand settings:', error);
        return res.status(500).json({ error: 'Failed to fetch brand settings' });
      }
      
      // If no settings found, return defaults
      if (!data) {
        return res.status(200).json({
          textDirection: 'ltr'
        });
      }
      
      return res.status(200).json({
        textDirection: data.text_direction || 'ltr',
        updatedAt: data.updated_at
      });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  else if (req.method === 'PUT') {
    // Update customer brand settings
    try {
      const { textDirection } = req.body;
      
      if (!textDirection || !['ltr', 'rtl'].includes(textDirection)) {
        return res.status(400).json({ error: 'Valid textDirection (ltr or rtl) is required' });
      }
      
      // Validate that customer exists
      const customerValidation = await validateCustomerId(customerId);
      if (!customerValidation.valid) {
        return res.status(400).json({ error: customerValidation.error });
      }
      
      const normalizedCustomerId = customerValidation.normalizedId;
      
      // Upsert brand settings
      const { data, error } = await supabase
        .from('customer_brand_settings')
        .upsert({
          customer_id: normalizedCustomerId,
          text_direction: textDirection,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving brand settings:', error);
        return res.status(500).json({ error: 'Failed to save brand settings' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Brand settings saved successfully',
        settings: {
          textDirection: data.text_direction,
          updatedAt: data.updated_at
        }
      });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle model_variants table creation instructions
 */
async function handleCreateVariantsTable(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    message: 'Please run the following SQL in your Supabase SQL editor to create the model_variants table',
    sql: `
-- Create model_variants table for furniture color/material variants
CREATE TABLE IF NOT EXISTS model_variants (
  id TEXT PRIMARY KEY,
  parent_model_id TEXT NOT NULL,
  variant_name VARCHAR(255) NOT NULL,
  hex_color VARCHAR(7) DEFAULT '#000000',
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  file_size BIGINT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  variant_type VARCHAR(50) DEFAULT 'upload', -- 'upload' or 'color'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key constraint
  CONSTRAINT fk_parent_model FOREIGN KEY (parent_model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_variants_parent ON model_variants(parent_model_id);
CREATE INDEX IF NOT EXISTS idx_variants_type ON model_variants(variant_type);
CREATE INDEX IF NOT EXISTS idx_variants_primary ON model_variants(is_primary);

-- Grant permissions
GRANT ALL ON model_variants TO authenticated;
GRANT ALL ON model_variants TO service_role;
    `,
    instructions: [
      '1. Go to your Supabase dashboard',
      '2. Navigate to SQL Editor',
      '3. Copy and paste the SQL above',
      '4. Click "Run" to create the model_variants table',
      '5. Test by trying a variant upload again'
    ]
  });
}

/**
 * Test brand settings schema with sample data
 */
async function handleTestBrandSettingsSchema(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const testCustomerId = 'TEST_CUSTOMER_001';
    
    if (req.method === 'POST') {
      // Test inserting sample brand settings data
      console.log('🧪 Testing brand settings schema with sample data...');
      
      const sampleData = {
        customer_id: testCustomerId,
        text_direction: 'rtl',
        logo_url: 'https://res.cloudinary.com/example/image/upload/v1/brand-assets/test-logo.png',
        primary_color: '#ff6b6b',
        secondary_color: '#4ecdc4',
        font_family: 'Roboto',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('customer_brand_settings')
        .upsert(sampleData)
        .select()
        .single();

      if (error) {
        console.error('❌ Schema test failed:', error);
        return res.status(500).json({ 
          error: 'Schema test failed', 
          details: error.message,
          hint: 'Make sure you ran the database migration first'
        });
      }

      console.log('✅ Sample data inserted successfully');
      return res.status(200).json({
        success: true,
        message: 'Brand settings schema test passed!',
        testData: data,
        schemaFields: ['id', 'customer_id', 'text_direction', 'logo_url', 'primary_color', 'secondary_color', 'font_family', 'created_at', 'updated_at']
      });
    }
    
    else if (req.method === 'GET') {
      // Test retrieving the sample data
      const { data, error } = await supabase
        .from('customer_brand_settings')
        .select('*')
        .eq('customer_id', testCustomerId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return res.status(500).json({ error: 'Failed to retrieve test data', details: error.message });
      }

      if (!data) {
        return res.status(200).json({
          message: 'No test data found. Use POST to create test data first.',
          instructions: 'Send a POST request to this endpoint to create sample data'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Schema validation successful!',
        testData: data,
        validation: {
          hasAllFields: !!(data.customer_id && data.text_direction !== undefined && 
                         data.logo_url !== undefined && data.primary_color && 
                         data.secondary_color && data.font_family),
          missingFields: []
        }
      });
    }

  } catch (error) {
    console.error('❌ Schema test error:', error);
    return res.status(500).json({ 
      error: 'Schema test failed', 
      details: error.message,
      hint: 'Check if the customer_brand_settings table exists and has all required columns'
    });
  }
}

/**
 * Handle USDZ file generation for iOS AR
 */
async function handleModelUSDZ(req, res, modelId) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log(`🔄 Generating USDZ for model: ${modelId}`);
    
    // Get model info including dimensions
    const model = await getModel(modelId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Get the GLB URL (Cloudinary URL)
    const glbUrl = model.cloudinary_url;
    if (!glbUrl) {
      return res.status(400).json({ error: 'Model does not have a valid GLB file URL' });
    }
    
    // Extract dimensions for scaling
    const dimensions = {
      width_meters: model.width_meters,
      height_meters: model.height_meters,
      depth_meters: model.depth_meters
    };
    
    console.log('📏 Model dimensions:', dimensions);
    
    // Convert GLB to USDZ with proper scaling
    const usdzBuffer = await convertGLBToUSDZ(glbUrl, dimensions);
    
    // Set appropriate headers for USDZ file
    res.setHeader('Content-Type', 'model/vnd.pixar.usd');
    res.setHeader('Content-Disposition', `attachment; filename="${model.title || model.filename || 'model'}.usdz"`);
    res.setHeader('Content-Length', usdzBuffer.byteLength);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Send the USDZ file
    res.status(200).send(Buffer.from(usdzBuffer));
    
    console.log(`✅ USDZ generated successfully for model: ${modelId}`);

  } catch (error) {
    console.error('❌ Error generating USDZ:', error);
    res.status(500).json({
      error: 'Failed to generate USDZ file',
      details: error.message
    });
  }
}

/**
 * Handle Cloudinary upload configuration for direct browser uploads
 */
async function handleCloudinaryConfig(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { v2: cloudinary } = await import('cloudinary');

    // Generate timestamp for signature
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Upload parameters (must match exactly what Cloudinary signs)
    // NOTE: resource_type is NOT included in signature for raw uploads
    const uploadParams = {
      folder: 'furniture-models',
      timestamp: timestamp,
      upload_preset: 'furniture_models' // May be required for security
    };

    // Generate signature
    const signature = cloudinary.utils.api_sign_request(uploadParams, process.env.CLOUDINARY_API_SECRET);

    return res.status(200).json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp: timestamp,
      signature: signature,
      uploadParams: uploadParams
    });

  } catch (error) {
    console.error('Error generating Cloudinary config:', error);
    return res.status(500).json({
      error: 'Failed to generate upload configuration',
      details: error.message
    });
  }
}

/**
 * Handle saving model metadata after successful Cloudinary upload
 */
async function handleCloudinarySave(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      cloudinaryUrl,
      cloudinaryPublicId,
      fileSize,
      title,
      description,
      customerId,
      customerName,
      dimensions,
      // Variant-specific fields
      parentModelId,
      variantName,
      hexColor,
      isVariant
    } = req.body;

    if (!cloudinaryUrl || !cloudinaryPublicId) {
      return res.status(400).json({ error: 'Cloudinary URL and public ID are required' });
    }

    let dbResult;

    if (isVariant && parentModelId && variantName) {
      // Handle variant upload
      console.log('Saving variant after direct upload...');
      dbResult = await saveModelVariant({
        parentModelId: parentModelId,
        variantName: variantName,
        hexColor: hexColor || '#000000',
        cloudinaryUrl: cloudinaryUrl,
        cloudinaryPublicId: cloudinaryPublicId,
        fileSize: fileSize || 0,
        isPrimary: false,
        variantType: 'upload'
      });
    } else {
      // Handle regular model upload
      console.log('Saving model after direct upload...');

      // Parse dimensions if provided
      let parsedDimensions = null;
      if (dimensions) {
        try {
          parsedDimensions = typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions;
        } catch (error) {
          console.warn('Failed to parse dimensions:', error.message);
        }
      }

      dbResult = await saveModel({
        title: title || 'Untitled Model',
        description: description || '',
        filename: cloudinaryPublicId.split('/').pop() + '.glb',
        cloudinaryUrl: cloudinaryUrl,
        cloudinaryPublicId: cloudinaryPublicId,
        fileSize: fileSize || 0,
        customerId: customerId || 'unassigned',
        customerName: customerName || 'Unassigned',
        dominantColor: '#6b7280',
        dimensions: parsedDimensions,
        metadata: {
          uploadMethod: 'direct',
          uploadedAt: new Date().toISOString()
        }
      });
    }

    if (!dbResult.success) {
      console.error('Database save failed:', dbResult.error);
      return res.status(500).json({
        error: 'Failed to save model to database',
        details: dbResult.error
      });
    }

    const domain = process.env.DOMAIN || 'newfurniture.live';

    if (isVariant) {
      // Variant response
      return res.status(200).json({
        success: true,
        id: dbResult.id,
        parentModelId: parentModelId,
        variantName: variantName,
        hexColor: hexColor || '#000000',
        cloudinaryUrl: cloudinaryUrl,
        viewUrl: `https://${domain}/view?id=${parentModelId}&variant=${dbResult.id}`,
        message: 'Variant uploaded successfully!'
      });
    } else {
      // Model response
      return res.status(200).json({
        success: true,
        id: dbResult.id,
        viewUrl: `https://${domain}/view?id=${dbResult.id}`,
        directUrl: cloudinaryUrl,
        shareUrl: `https://${domain}/view?id=${dbResult.id}`,
        title: title,
        fileSize: fileSize,
        message: 'Model uploaded successfully!'
      });
    }

  } catch (error) {
    console.error('Error saving after Cloudinary upload:', error);
    return res.status(500).json({
      error: 'Failed to save model metadata',
      details: error.message
    });
  }
}