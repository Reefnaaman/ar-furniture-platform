import { uploadModel } from '../lib/cloudinary.js';
import { saveModel, getModel, getAllModels, getModelsWithVariants, getModelsByCustomer, getModelsByCustomerWithVariants, getCustomers, getStats, deleteModel, incrementViewCount, updateModelCustomer, supabase, query } from '../lib/supabase.js';
import { deleteModel as deleteFromCloudinary } from '../lib/cloudinary.js';
import multiparty from 'multiparty';
import bcrypt from 'bcryptjs';

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
  console.log('=== FUNCTION ENTRY ===', new Date().toISOString());
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
    
    // Route: /api/create-model-views-table
    if (routePath === 'create-model-views-table') {
      return await handleCreateModelViewsTable(req, res);
    }
    
    // Route: /api/init-models-db
    if (routePath === 'init-models-db') {
      return await handleInitModelsDB(req, res);
    }
    
    // Route: /api/test-save-model
    if (routePath === 'test-save-model') {
      return await handleTestSaveModel(req, res);
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

    // Route: /api/login - User authentication
    if (routePath === 'login') {
      if (req.method === 'POST') {
        try {
          const { username, password } = req.body;
          
          if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
          }
          
          // Find user by username (using template literal like other queries)
          const userResult = await query(`
            SELECT * FROM users 
            WHERE username = '${username}' AND is_active = true
          `);
          
          if (!userResult.success || !userResult.data || userResult.data.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          
          const user = userResult.data[0];
          
          // Verify password
          const passwordMatch = await bcrypt.compare(password, user.password_hash);
          
          if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          
          // Set basic session cookie (simplified)
          res.setHeader('Set-Cookie', [
            `user_role=${user.role}; Path=/; Max-Age=86400; SameSite=Strict`,
            `user_id=${user.id}; Path=/; Max-Age=86400; SameSite=Strict`
          ]);
          
          return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
              customerId: user.customer_id,
              customerName: user.customer_name
            },
            redirectUrl: user.role === 'admin' ? '/admin.html' : `/customer.html?customer=${user.customer_id}`
          });
          
        } catch (error) {
          console.error('Login error:', error);
          return res.status(500).json({ 
            error: 'Login failed', 
            details: error.message 
          });
        }
      }
      
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Route: /api/customer?customer=id (for query parameter format)
    if (routePath === 'customer') {
      const customerId = url.searchParams.get('customer');
      if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required' });
      }
      return await handleCustomerModels(req, res, customerId);
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
      dominantColor: '#6b7280', // Will be updated by frontend after color extraction
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
    const { id, title } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Model ID required' });
    }
    
    try {
      // Update model title in database
      const { error } = await supabase
        .from('models')
        .update({ title })
        .eq('id', id);

      if (error) throw error;
      
      res.status(200).json({ success: true, message: 'Model updated successfully' });
      
    } catch (error) {
      console.error('Error updating model:', error);
      res.status(500).json({ error: 'Failed to update model' });
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
      metadata: model.metadata,
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
 * Handle model view tracking with variant support
 */
async function handleModelView(req, res, modelId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get variant ID from query parameter
    const url = new URL(req.url, `https://${req.headers.host}`);
    const variantId = url.searchParams.get('variant');
    
    console.log(`📊 Tracking view for model ${modelId}, variant: ${variantId || 'original'}`);
    
    const result = await incrementViewCount(modelId, variantId);
    
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
 * Handle image upload (logos, brand assets, etc.)
 */
async function handleImageUpload(req, res) {
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

    // Save to database
    console.log('Saving image to database...');
    const imageType = fields.imageType?.[0] || 'general';
    const customerId = fields.customerId?.[0] || null;
    const customerName = fields.customerName?.[0] || null;
    
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
        query = query.eq('image_type', imageType);
      }
      
      if (customerId) {
        query = query.eq('customer_id', customerId);
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
 * Handle creating model_views table for variant tracking
 */
async function handleCreateModelViewsTable(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    message: 'Please run the following SQL in your Supabase SQL editor to enable per-variant view tracking',
    sql: `
-- Create model_views table for detailed view tracking per variant
CREATE TABLE IF NOT EXISTS model_views (
  id BIGSERIAL PRIMARY KEY,
  model_id TEXT NOT NULL,
  variant_id TEXT NULL, -- NULL for original variant
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_hash TEXT
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_model_views_model ON model_views(model_id);
CREATE INDEX IF NOT EXISTS idx_model_views_variant ON model_views(variant_id);
CREATE INDEX IF NOT EXISTS idx_model_views_date ON model_views(viewed_at);

-- Grant permissions
GRANT ALL ON model_views TO authenticated;
GRANT ALL ON model_views TO service_role;
GRANT USAGE, SELECT ON SEQUENCE model_views_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE model_views_id_seq TO service_role;
    `,
    instructions: [
      '1. Go to your Supabase dashboard',
      '2. Navigate to SQL Editor', 
      '3. Copy and paste the SQL above',
      '4. Click "Run" to create the table',
      '5. This enables detailed per-variant view analytics'
    ]
  });
}