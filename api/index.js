import { uploadModel } from '../lib/cloudinary.js';
import { saveModel, saveModelVariant, getModel, getAllModels, getModelsWithVariants, getModelsByCustomer, getModelsByCustomerWithVariants, getCustomers, getStats, deleteModel, incrementViewCount, updateModelCustomer, supabase, query } from '../lib/supabase.js';
import { deleteModel as deleteFromCloudinary } from '../lib/cloudinary.js';
import { validateFileContent, sanitizeFilename, checkRateLimit, getRateLimitHeaders, hashIP } from '../lib/security.js';
import { logger } from '../lib/logger.js';
import { getInternalEndpoint } from '../lib/endpoints.js';
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
 * Create secure error response that doesn't leak internal details in production
 */
function createErrorResponse(statusCode, message, error = null) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const response = { error: message };
  
  if (isDevelopment && error) {
    response.details = error.message;
    if (error.stack) {
      response.stack = error.stack;
    }
  }
  
  return { statusCode, response };
}

/**
 * Single catch-all API handler for all routes
 * Handles: upload, models, model/[id], model/[id]/info, model/[id]/view
 */
export default async function handler(req, res) {
  logger.debug('Function entry', { 
    method: req.method, 
    timestamp: new Date().toISOString() 
  });
  
  // Rate limiting for sensitive endpoints
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const ipHash = hashIP(clientIP);
  
  // Apply rate limiting to upload and authentication endpoints
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const routePath = pathParts.slice(1).join('/');
  
  if (['upload-simple', 'upload-image', 'login', 'create-user'].includes(routePath)) {
    const rateLimit = checkRateLimit(ipHash, 60000, 10); // 10 requests per minute
    
    // Set rate limit headers
    const headers = getRateLimitHeaders(rateLimit);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: rateLimit.resetTime - Math.floor(Date.now() / 1000)
      });
    }
  }
  
  logger.debug('Route processing', { routePath });
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CORS headers (restrict in production)
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://newfurniture.live', 'https://www.newfurniture.live']
    : ['*'];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Parse route from URL path instead of query params
    const url = new URL(req.url, `https://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean); // ['api', 'upload-simple'] or ['api', 'models']
    const routePath = pathParts.slice(1).join('/'); // Remove 'api' prefix: 'upload-simple' or 'models'
    
    logger.debug('Route debug', { routePath, method: req.method });
    
    logger.debug('Users route detected', { routePath });
    
    logger.debug('Model route detected', { routePath });
    
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
    
    // Route: /api/update-variant-color
    if (routePath === 'update-variant-color') {
      return await handleUpdateVariantColor(req, res);
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
    
    // Route: /api/reset-view-counts
    if (routePath === 'reset-view-counts') {
      return await handleResetViewCounts(req, res);
    }
    
    // Route: /api/feedback
    if (routePath === 'feedback') {
      return await handleFeedback(req, res);
    }
    
    // Route: /api/create-feedback-table
    if (routePath === 'create-feedback-table') {
      return await handleCreateFeedbackTable(req, res);
    }
    
    // Route: /api/create-brand-settings-table
    if (routePath === 'create-brand-settings-table') {
      return await handleCreateBrandSettingsTable(req, res);
    }
    
    // Route: /api/init-models-db
    if (routePath === 'init-models-db') {
      return await handleInitModelsDB(req, res);
    }
    
    // Route: /api/test-save-model
    if (routePath === 'test-save-model') {
      return await handleTestSaveModel(req, res);
    }
    
    // Route: /api/test-columns (debug endpoint)
    if (routePath === 'test-columns') {
      try {
        const result = await query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'models' AND column_name = 'product_url'
        `);
        
        const variantResult = await query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'model_variants' AND column_name = 'product_url'
        `);
        
        return res.status(200).json({
          models_product_url: result.data,
          model_variants_product_url: variantResult.data
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }
    
    // Route: /api/debug-update (test update functionality)
    if (routePath === 'debug-update') {
      try {
        // Test a simple update on the first model
        const testResult = await query(`
          SELECT id, title, product_url FROM models LIMIT 1
        `);
        
        if (!testResult.success || !testResult.data || testResult.data.length === 0) {
          return res.status(400).json({ error: 'No models found to test with' });
        }
        
        const testModel = testResult.data[0];
        const testUrl = 'https://test-url.com';
        
        console.log('🧪 Testing update on model:', testModel.id);
        
        const updateResult = await query(`
          UPDATE models 
          SET product_url = $1, updated_at = NOW() 
          WHERE id = $2
        `, [testUrl, testModel.id]);
        
        return res.status(200).json({
          original_model: testModel,
          update_result: updateResult,
          test_url_set: testUrl
        });
        
      } catch (error) {
        console.error('Debug update error:', error);
        return res.status(500).json({ error: error.message, stack: error.stack });
      }
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
          
          // Find user by username (using parameterized query to prevent SQL injection)
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('is_active', true)
            .single();
          
          if (userError || !userData) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          
          const user = userData;
          
          // Verify password
          const passwordMatch = await bcrypt.compare(password, user.password_hash);
          
          if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }
          
          // Set secure session cookies
          const isProduction = process.env.NODE_ENV === 'production';
          res.setHeader('Set-Cookie', [
            `user_role=${user.role}; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict${isProduction ? '; Secure' : ''}`,
            `user_id=${user.id}; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict${isProduction ? '; Secure' : ''}`
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
          logger.error('Login error', error);
          const { statusCode, response } = createErrorResponse(500, 'Login failed', error);
          return res.status(statusCode).json(response);
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
    
    // Route: /api/customers/[id]/brand-settings
    if (routePath?.match(/^customers\/[^\/]+\/brand-settings$/)) {
      const customerId = routePath.split('/')[1];
      return await handleBrandSettings(req, res, customerId);
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
    
    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    return res.status(500).json({ 
      error: 'Something went wrong on our end. Please try again in a few moments.',
      message: 'Service temporarily unavailable',
      showReportButton: true,
      reportData: {
        errorType: 'server_error',
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'] || 'unknown'
      }
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

    // Variant detection logic
    const parentModelId = fields.parentModelId?.[0];
    const variantName = fields.variantName?.[0];
    const isVariantUpload = parentModelId && variantName && 
                           parentModelId.trim() !== '' && variantName.trim() !== '';
    
    logger.debug('Upload type detected', { 
      isVariant: isVariantUpload 
    });

    // Get file
    const uploadedFile = files.file?.[0];
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(uploadedFile.originalFilename);
    
    // Validate file type and extension
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
    
    // Validate file content using magic numbers
    const contentValidation = validateFileContent(fileBuffer, uploadedFile.originalFilename, ['glb', 'gltf']);
    if (!contentValidation.valid) {
      fs.unlinkSync(uploadedFile.path); // Clean up temp file
      return res.status(400).json({ error: `Security validation failed: ${contentValidation.error}` });
    }

    // Upload to Cloudinary
    logger.debug('Starting file upload');
    const cloudinaryResult = await uploadModel(fileBuffer, uploadedFile.originalFilename);

    // Save to database - VARIANT OR MODEL
    let dbResult;
    
    if (isVariantUpload) {
      logger.debug('Saving variant to database');
      const hexColor = fields.hexColor?.[0] || '#000000';
      
      dbResult = await saveModelVariant({
        parentModelId: parentModelId,
        variantName: variantName,
        hexColor: hexColor,
        cloudinaryUrl: cloudinaryResult.url,
        cloudinaryPublicId: cloudinaryResult.publicId,
        fileSize: cloudinaryResult.size,
        isPrimary: false,
        variantType: 'upload',
        productUrl: fields.variant_product_url?.[0] || null
      });
    } else {
      logger.debug('Saving model to database');
      
      dbResult = await saveModel({
        title: fields.title?.[0] || uploadedFile.originalFilename.replace(/\.(glb|gltf)$/i, ''),
        description: fields.description?.[0] || '',
        filename: uploadedFile.originalFilename,
        cloudinaryUrl: cloudinaryResult.url,
        cloudinaryPublicId: cloudinaryResult.publicId,
        fileSize: cloudinaryResult.size,
        customerId: fields.customerId?.[0] || 'unassigned',
        customerName: fields.customerName?.[0] || 'Unassigned',
        dominantColor: '#6b7280', // Will be updated by frontend after color extraction
        productUrl: fields.product_url?.[0] || null, // Product URL for back button
        metadata: {
          mimetype: uploadedFile.headers['content-type'],
          uploadedAt: new Date().toISOString()
        }
      });
    }

    logger.debug('Database save completed');

    if (!dbResult.success) {
      logger.error('Database save failed', dbResult.error);
      return res.status(500).json({ 
        error: 'Unable to complete upload at this time. Please try again in a few moments.',
        message: 'Upload processing failed',
        showReportButton: true,
        reportData: {
          errorType: 'upload_failed',
          filename: uploadedFile?.originalFilename || 'unknown',
          timestamp: new Date().toISOString()
        }
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
        message: '🎨 Variant uploaded successfully!',
        debugInfo: {
          uploadType: 'variant',
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
        message: '📦 Furniture uploaded successfully!',
        debugInfo: {
          uploadType: 'model',
          detectedAs: 'regular model'
        }
      });
    }

  } catch (error) {
    logger.error('Upload error', error);
    const { statusCode, response } = createErrorResponse(500, 'Upload failed', error);
    return res.status(statusCode).json(response);
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
      res.status(500).json({ error: 'Unable to load your furniture collection. Please refresh the page and try again.' });
    }
  }
  
  // Update a model
  else if (req.method === 'PUT') {
    const { id, title, product_url } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Model ID required' });
    }
    
    try {
      // Build update object with only provided fields
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (product_url !== undefined) updateData.product_url = product_url || null;
      
      // Build SQL query dynamically for the fields we want to update
      const setClauses = [];
      const values = [];
      let paramIndex = 1;
      
      if (title !== undefined) {
        setClauses.push(`title = $${paramIndex}`);
        values.push(title);
        paramIndex++;
      }
      
      if (product_url !== undefined) {
        setClauses.push(`product_url = $${paramIndex}`);
        values.push(product_url || null);
        paramIndex++;
      }
      
      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      // Add the ID parameter for WHERE clause
      values.push(id);
      
      const updateQuery = `
        UPDATE models 
        SET ${setClauses.join(', ')}, updated_at = NOW() 
        WHERE id = $${paramIndex}
      `;
      
      console.log('🔄 Executing update query:', updateQuery);
      console.log('🔄 With values:', values);
      
      // Update model in database using raw query (same as migration)
      const result = await query(updateQuery, values);
      
      if (!result.success) {
        console.error('Query execution failed:', result.error);
        throw new Error(result.error || 'Database update failed');
      }
      
      res.status(200).json({ success: true, message: 'Model updated successfully' });
      
    } catch (error) {
      console.error('Error updating model:', error);
      console.error('Error details:', error.message);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      // Check if it's a column not found error
      if (error.code === '42703') {
        res.status(500).json({ 
          error: 'Database column missing. Please run migration at /api/init-models-db',
          details: 'The product_url column needs to be added to the database'
        });
      } else if (error.message && error.message.includes('column')) {
        res.status(500).json({ 
          error: 'Database schema issue. Column might be missing.',
          details: error.message
        });
      } else {
        res.status(500).json({ 
          error: 'Unable to save changes. Please try again.',
          details: error.message || 'Unknown error'
        });
      }
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
      return res.status(404).json({ error: 'Furniture item not found' });
    }
    
    // Redirect to Cloudinary URL for the actual file
    res.redirect(302, model.cloudinary_url);
    
  } catch (error) {
    console.error('Error fetching model:', error);
    res.status(500).json({ error: 'Unable to load the requested furniture model. Please check the link and try again.' });
  }
}

/**
 * Handle model info with variants
 */
async function handleModelInfo(req, res, modelId) {
  try {
    const model = await getModel(modelId);
    
    if (!model) {
      return res.status(404).json({ error: 'Furniture item not found' });
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
    
    // Return model info with variants (including Cloudinary URL for AR variant switching)
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
      product_url: model.product_url, // Include for back button functionality
      metadata: model.metadata,
      cloudinary_url: model.cloudinary_url, // Include for AR original variant switching
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
    res.status(500).json({ error: 'Unable to load furniture details. Please try again.' });
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
      return res.status(404).json({ error: 'Furniture item not found' });
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
 * Handle updating variant color
 */
async function handleUpdateVariantColor(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { variantId, dominantColor } = req.body;
    
    if (!variantId || !dominantColor) {
      return res.status(400).json({ error: 'Variant ID and dominant color required' });
    }
    
    // Validate hex color format
    if (!/^#[0-9A-Fa-f]{6}$/.test(dominantColor)) {
      return res.status(400).json({ error: 'Invalid hex color format' });
    }

    // Update variant hex color in database
    const { error } = await supabase
      .from('model_variants')
      .update({ hex_color: dominantColor })
      .eq('id', variantId);

    if (error) {
      console.error('Error updating variant color:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update variant color',
        details: error.message
      });
    }
    
    console.log(`✅ Updated variant color for ${variantId}: ${dominantColor}`);

    return res.status(200).json({
      success: true,
      message: 'Variant color updated successfully',
      variantId,
      dominantColor
    });

  } catch (error) {
    console.error('💥 Update variant color error:', error);
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

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(uploadedFile.originalFilename);
    
    // Validate file type and extension
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
    
    // Validate file content using magic numbers
    const allowedImageTypes = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
    const contentValidation = validateFileContent(fileBuffer, uploadedFile.originalFilename, allowedImageTypes);
    if (!contentValidation.valid) {
      fs.unlinkSync(uploadedFile.path); // Clean up temp file
      return res.status(400).json({ error: `Security validation failed: ${contentValidation.error}` });
    }

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
  product_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_models_customer ON models(customer_id);
CREATE INDEX IF NOT EXISTS idx_models_created ON models(created_at);

-- Add product_url column if it doesn't exist (migration)
ALTER TABLE models ADD COLUMN IF NOT EXISTS product_url TEXT;

-- Create model_variants table
CREATE TABLE IF NOT EXISTS model_variants (
  id TEXT PRIMARY KEY,
  parent_model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  variant_name VARCHAR(255) NOT NULL,
  hex_color VARCHAR(7) DEFAULT '#000000',
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  file_size INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  variant_type VARCHAR(50) DEFAULT 'upload',
  product_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for model_variants
CREATE INDEX IF NOT EXISTS idx_model_variants_parent ON model_variants(parent_model_id);
CREATE INDEX IF NOT EXISTS idx_model_variants_primary ON model_variants(is_primary);

-- Add product_url column to existing model_variants table if it doesn't exist (migration)
ALTER TABLE model_variants ADD COLUMN IF NOT EXISTS product_url TEXT;

-- Grant permissions
GRANT ALL ON models TO authenticated;
GRANT ALL ON models TO service_role;
GRANT ALL ON model_variants TO authenticated;
GRANT ALL ON model_variants TO service_role;
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

/**
 * Handle resetting all view counts to 0
 */
async function handleResetViewCounts(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Resetting all view counts to 0...');
    
    // Reset view_count in models table - use not equal to impossible value to match all rows
    const { error: modelsError } = await supabase
      .from('models')
      .update({ view_count: 0 })
      .not('id', 'eq', 'impossible_id_that_never_exists');

    if (modelsError) {
      console.error('Error resetting models view counts:', modelsError);
      return res.status(500).json({ 
        error: 'Failed to reset model view counts',
        details: modelsError.message 
      });
    }

    // Clear all records from model_views table (if it exists)
    let viewsCleared = 0;
    try {
      const { error: viewsError, count } = await supabase
        .from('model_views')
        .delete()
        .neq('id', 0); // Delete all records

      if (!viewsError) {
        viewsCleared = count || 0;
        console.log(`✅ Cleared ${viewsCleared} detailed view records`);
      }
    } catch (viewsTableError) {
      console.log('📝 model_views table not found (this is okay for first setup)');
    }

    console.log('✅ All view counts reset to 0');

    return res.status(200).json({
      success: true,
      message: 'All view counts reset to 0',
      modelsReset: true,
      detailedViewsCleared: viewsCleared,
      instructions: 'You can now test the per-variant view tracking system from a clean state'
    });

  } catch (error) {
    console.error('💥 Reset view counts error:', error);
    return res.status(500).json({ 
      error: error.message,
      solution: 'Check your Supabase configuration and try again'
    });
  }
}

/**
 * Handle feedback submission and retrieval
 */
async function handleFeedback(req, res) {
  if (req.method === 'POST') {
    // Submit new feedback
    try {
      const {
        type,
        categories,
        comment,
        customerId,
        itemId,
        itemName,
        userAgent
      } = req.body;

      if (!type || !customerId || !itemId) {
        return res.status(400).json({
          error: 'Missing required fields: type, customerId, itemId'
        });
      }

      // Generate feedback ID
      const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Save feedback to database
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          id: feedbackId,
          feedback_type: type,
          categories: categories || [],
          comment: comment || null,
          customer_id: customerId,
          model_id: itemId,
          model_name: itemName,
          user_agent: userAgent,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving feedback:', error);
        return res.status(500).json({
          error: 'Failed to save feedback',
          details: error.message
        });
      }

      console.log(`✅ Feedback saved: ${type} for ${itemName} by customer ${customerId}`);

      return res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully',
        feedbackId: feedbackId
      });

    } catch (error) {
      console.error('Error handling feedback submission:', error);
      return res.status(500).json({
        error: 'Failed to process feedback',
        details: error.message
      });
    }
  } else if (req.method === 'GET') {
    // Retrieve feedback (for admin)
    try {
      const url = new URL(req.url, `https://${req.headers.host}`);
      const customerId = url.searchParams.get('customer');
      const modelId = url.searchParams.get('model');
      const limit = parseInt(url.searchParams.get('limit')) || 100;

      let query = supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (modelId) {
        query = query.eq('model_id', modelId);
      }

      query = query.limit(limit);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching feedback:', error);
        return res.status(500).json({
          error: 'Failed to fetch feedback',
          details: error.message
        });
      }

      return res.status(200).json({
        success: true,
        feedback: data || []
      });

    } catch (error) {
      console.error('Error handling feedback retrieval:', error);
      return res.status(500).json({
        error: 'Failed to retrieve feedback',
        details: error.message
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle creating feedback table
 */
async function handleCreateFeedbackTable(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    message: 'Please run the following SQL in your Supabase SQL editor to create the feedback system',
    sql: `
-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'error')),
  categories TEXT[] DEFAULT '{}',
  comment TEXT,
  customer_id VARCHAR(100) NOT NULL,
  model_id TEXT NOT NULL,
  model_name VARCHAR(255),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedback_customer ON feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_model ON feedback(model_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_date ON feedback(created_at);

-- Grant permissions
GRANT ALL ON feedback TO authenticated;
GRANT ALL ON feedback TO service_role;
    `,
    instructions: [
      '1. Go to your Supabase dashboard',
      '2. Navigate to SQL Editor',
      '3. Copy and paste the SQL above',
      '4. Click "Run" to create the feedback table',
      '5. This enables customer feedback collection and admin viewing'
    ]
  });
}

/**
 * Handle brand settings for customers
 */
async function handleBrandSettings(req, res, customerId) {
  if (req.method === 'GET') {
    // Get brand settings for customer
    try {
      const { data, error } = await supabase
        .from('brand_settings')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching brand settings:', error);
        return res.status(500).json({ error: 'Failed to fetch brand settings' });
      }

      // Return settings or defaults
      const settings = data || {
        customer_id: customerId,
        text_direction: 'ltr',
        primary_color: '#58a6ff',
        secondary_color: '#4e9eff',
        font_family: 'Inter',
        logo_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return res.status(200).json(settings);

    } catch (error) {
      console.error('Error handling brand settings GET:', error);
      return res.status(500).json({ error: 'Failed to process request' });
    }
  }

  if (req.method === 'PUT') {
    // Update brand settings for customer
    try {
      const { textDirection, primaryColor, secondaryColor, fontFamily, logoUrl } = req.body;

      const settingsData = {
        customer_id: customerId,
        text_direction: textDirection || 'ltr',
        primary_color: primaryColor || '#58a6ff',
        secondary_color: secondaryColor || '#4e9eff', 
        font_family: fontFamily || 'Inter',
        logo_url: logoUrl || null,
        updated_at: new Date().toISOString()
      };

      // Upsert brand settings
      const { data, error } = await supabase
        .from('brand_settings')
        .upsert(settingsData, {
          onConflict: 'customer_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving brand settings:', error);
        return res.status(500).json({ 
          error: 'Failed to save brand settings',
          details: error.message 
        });
      }

      console.log(`✅ Brand settings saved for customer ${customerId}`);

      return res.status(200).json({
        success: true,
        message: 'Brand settings saved successfully',
        settings: data
      });

    } catch (error) {
      console.error('Error handling brand settings PUT:', error);
      return res.status(500).json({ 
        error: 'Failed to process request',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Handle creating brand settings table
 */
async function handleCreateBrandSettingsTable(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    message: 'Please run the following SQL in your Supabase SQL editor to create the brand settings system',
    sql: `
-- Create brand_settings table
CREATE TABLE IF NOT EXISTS brand_settings (
  id BIGSERIAL PRIMARY KEY,
  customer_id VARCHAR(100) NOT NULL UNIQUE,
  text_direction VARCHAR(10) DEFAULT 'ltr' CHECK (text_direction IN ('ltr', 'rtl')),
  primary_color VARCHAR(7) DEFAULT '#58a6ff',
  secondary_color VARCHAR(7) DEFAULT '#4e9eff',
  font_family VARCHAR(100) DEFAULT 'Inter',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_brand_settings_customer ON brand_settings(customer_id);

-- Grant permissions
GRANT ALL ON brand_settings TO authenticated;
GRANT ALL ON brand_settings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE brand_settings_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE brand_settings_id_seq TO service_role;
    `,
    instructions: [
      '1. Go to your Supabase dashboard',
      '2. Navigate to SQL Editor',
      '3. Copy and paste the SQL above',
      '4. Click "Run" to create the brand settings table',
      '5. This enables customer brand customization settings'
    ]
  });
}