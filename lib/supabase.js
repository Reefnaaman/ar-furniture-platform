import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);
export { supabase };

/**
 * Save model to Supabase
 */
export async function saveModel({
  title,
  description,
  filename,
  cloudinaryUrl,
  cloudinaryPublicId,
  fileSize,
  customerId = 'unassigned',
  customerName = 'Unassigned',
  metadata = {}
}) {
  // Dynamic import for nanoid to avoid ES module issues
  const { nanoid } = await import('nanoid');
  const id = nanoid(8);
  
  try {
    const { data, error } = await supabase
      .from('models')
      .insert([
        {
          id,
          title: title || filename,
          description: description || '',
          filename,
          cloudinary_url: cloudinaryUrl,
          cloudinary_public_id: cloudinaryPublicId,
          file_size: fileSize,
          customer_id: customerId,
          customer_name: customerName,
          metadata
        }
      ])
      .select();

    if (error) throw error;

    return { id, success: true };
  } catch (error) {
    console.error('Supabase save error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get model by ID
 */
export async function getModel(id) {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Supabase get error:', error);
    return null;
  }
}

/**
 * Increment view count
 */
export async function incrementViewCount(id) {
  try {
    // First, get the current view count
    const { data: model, error: fetchError } = await supabase
      .from('models')
      .select('view_count')
      .eq('id', id)
      .single();
      
    if (fetchError) {
      console.error('Error fetching model for view increment:', fetchError);
      return { success: false };
    }
    
    // Increment the view count
    const newViewCount = (model.view_count || 0) + 1;
    
    const { error: updateError } = await supabase
      .from('models')
      .update({ view_count: newViewCount })
      .eq('id', id);
      
    if (updateError) {
      console.error('Error updating view count:', updateError);
      return { success: false };
    }
    
    console.log(`View count incremented for model ${id}: ${newViewCount}`);
    return { success: true };
  } catch (error) {
    console.error('Supabase increment error:', error);
    return { success: false };
  }
}

/**
 * Get all models
 */
export async function getAllModels(limit = 100, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .order('upload_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Supabase list error:', error);
    return [];
  }
}

/**
 * Get models by customer ID
 */
export async function getModelsByCustomer(customerId, limit = 100, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('customer_id', customerId)
      .order('upload_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Supabase customer list error:', error);
    return [];
  }
}

/**
 * Get all customers with model counts
 */
export async function getCustomers() {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('customer_id, customer_name')
      .order('customer_name');

    if (error) throw error;

    // Group by customer and count
    const customerMap = new Map();
    data.forEach(model => {
      const key = model.customer_id;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          id: model.customer_id,
          name: model.customer_name,
          count: 0
        });
      }
      customerMap.get(key).count++;
    });

    return Array.from(customerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Supabase customers error:', error);
    return [{ id: 'unassigned', name: 'Unassigned', count: 0 }];
  }
}

/**
 * Delete model
 */
export async function deleteModel(id) {
  try {
    const { error } = await supabase
      .from('models')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Supabase delete error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get statistics
 */
export async function getStats() {
  try {
    const { data: models, error } = await supabase
      .from('models')
      .select('view_count, file_size');

    if (error) throw error;

    const stats = models.reduce((acc, model) => ({
      totalModels: acc.totalModels + 1,
      totalViews: acc.totalViews + (model.view_count || 0),
      totalSize: acc.totalSize + (model.file_size || 0)
    }), { totalModels: 0, totalViews: 0, totalSize: 0 });

    return stats;
  } catch (error) {
    console.error('Supabase stats error:', error);
    return { totalModels: 0, totalViews: 0, totalSize: 0 };
  }
}

/**
 * Update model customer assignment and ensure user exists
 */
export async function updateModelCustomer(modelId, customerId, customerName) {
  try {
    // First, ensure the customer exists as a user
    await ensureCustomerUserExists(customerId, customerName);
    
    const { data, error } = await supabase
      .from('models')
      .update({ 
        customer_id: customerId, 
        customer_name: customerName 
      })
      .eq('id', modelId)
      .select();

    if (error) throw error;
    return { success: true, data: data[0] };
  } catch (error) {
    console.error('Supabase update customer error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ensure a customer exists as a user record
 */
async function ensureCustomerUserExists(customerId, customerName) {
  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('customer_id', customerId)
      .single();
      
    if (existingUser) {
      console.log(`User already exists for customer ${customerId}`);
      return;
    }
    
    // Create user record for this customer
    const bcrypt = await import('bcryptjs');
    const { nanoid } = await import('nanoid');
    
    const userId = nanoid(8);
    const defaultPassword = `${customerId}123`; // Simple default password
    const hashedPassword = await bcrypt.default.hash(defaultPassword, 10);
    
    const { error: createError } = await supabase
      .from('users')
      .insert([{
        id: userId,
        username: customerId,
        password_hash: hashedPassword,
        role: 'customer',
        customer_id: customerId,
        customer_name: customerName,
        is_active: true
      }]);
      
    if (createError) {
      console.error('Error creating user for customer:', createError);
    } else {
      console.log(`Created user for customer ${customerId} with default password: ${defaultPassword}`);
    }
    
  } catch (error) {
    console.error('Error ensuring customer user exists:', error);
  }
}

/**
 * Migrate existing customers to users (one-time migration)
 */
export async function migrateCustomersToUsers() {
  try {
    console.log('🚀 Starting migration...');
    
    // Get all unique customers from models
    const customers = await getCustomers();
    console.log(`📊 Found ${customers.length} customers:`, customers);
    
    const bcrypt = await import('bcryptjs');
    const { nanoid } = await import('nanoid');
    
    let migratedCount = 0;
    let existingCount = 0;
    const migrationResults = [];
    
    for (const customer of customers) {
      if (customer.id === 'unassigned') {
        console.log('⏭️ Skipping unassigned customer');
        continue;
      }
      
      console.log(`🔍 Checking customer: ${customer.id} (${customer.name})`);
      
      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, username')
        .eq('customer_id', customer.id)
        .single();
        
      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`❌ Error checking user for ${customer.id}:`, checkError);
        continue;
      }
        
      if (existingUser) {
        console.log(`✅ User already exists for ${customer.id}: ${existingUser.username}`);
        existingCount++;
        migrationResults.push({ customer: customer.id, status: 'exists', username: existingUser.username });
      } else {
        console.log(`🆕 Creating user for ${customer.id}...`);
        
        const userId = nanoid(8);
        const defaultPassword = `${customer.id}123`;
        const hashedPassword = await bcrypt.default.hash(defaultPassword, 10);
        
        const { error: createError } = await supabase
          .from('users')
          .insert([{
            id: userId,
            username: customer.id,
            password_hash: hashedPassword,
            role: 'customer',
            customer_id: customer.id,
            customer_name: customer.name,
            is_active: true
          }]);
          
        if (createError) {
          console.error(`❌ Failed to create user for ${customer.id}:`, createError);
          migrationResults.push({ customer: customer.id, status: 'failed', error: createError.message });
        } else {
          migratedCount++;
          console.log(`✅ Created user for ${customer.id} with password: ${defaultPassword}`);
          migrationResults.push({ customer: customer.id, status: 'created', username: customer.id, password: defaultPassword });
        }
      }
    }
    
    console.log(`🎉 Migration complete! Created: ${migratedCount}, Existing: ${existingCount}`);
    console.log('📋 Migration results:', migrationResults);
    
    return { 
      success: true, 
      migratedCount, 
      existingCount, 
      totalCustomers: customers.length,
      results: migrationResults
    };
  } catch (error) {
    console.error('💥 Migration error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save model variant to Supabase
 */
export async function saveModelVariant({
  parentModelId,
  variantName,
  hexColor,
  cloudinaryUrl,
  cloudinaryPublicId,
  fileSize,
  isPrimary = false,
  variantType = 'upload'
}) {
  const { nanoid } = await import('nanoid');
  const id = nanoid(8);
  
  try {
    const { data, error } = await supabase
      .from('model_variants')
      .insert([
        {
          id,
          parent_model_id: parentModelId,
          variant_name: variantName,
          hex_color: hexColor,
          cloudinary_url: cloudinaryUrl,
          cloudinary_public_id: cloudinaryPublicId,
          file_size: fileSize,
          is_primary: isPrimary,
          variant_type: variantType
        }
      ])
      .select();

    if (error) throw error;

    return { id, success: true, data: data[0] };
  } catch (error) {
    console.error('Supabase save variant error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all variants for a model
 */
export async function getModelVariants(modelId) {
  try {
    const { data, error } = await supabase
      .from('model_variants')
      .select('*')
      .eq('parent_model_id', modelId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Supabase get variants error:', error);
    return [];
  }
}

/**
 * Get models with their variants
 */
export async function getModelsWithVariants(limit = 100, offset = 0) {
  try {
    // Get models
    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('*')
      .order('upload_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (modelsError) throw modelsError;

    // Get variants for all models
    const modelIds = models.map(m => m.id);
    const { data: variants, error: variantsError } = await supabase
      .from('model_variants')
      .select('*')
      .in('parent_model_id', modelIds)
      .order('is_primary', { ascending: false });

    if (variantsError) throw variantsError;

    // Group variants by model
    const variantsByModel = variants.reduce((acc, variant) => {
      if (!acc[variant.parent_model_id]) {
        acc[variant.parent_model_id] = [];
      }
      acc[variant.parent_model_id].push(variant);
      return acc;
    }, {});

    // Add variants to models
    const modelsWithVariants = models.map(model => ({
      ...model,
      variants: variantsByModel[model.id] || []
    }));

    return modelsWithVariants;
  } catch (error) {
    console.error('Supabase get models with variants error:', error);
    return [];
  }
}

/**
 * Get models by customer with their variants
 */
export async function getModelsByCustomerWithVariants(customerId, limit = 100, offset = 0) {
  try {
    // Get models for this customer
    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('*')
      .eq('customer_id', customerId)
      .order('upload_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (modelsError) throw modelsError;

    // Get variants for these models
    const modelIds = models.map(m => m.id);
    if (modelIds.length === 0) return [];

    const { data: variants, error: variantsError } = await supabase
      .from('model_variants')
      .select('*')
      .in('parent_model_id', modelIds)
      .order('is_primary', { ascending: false });

    if (variantsError) throw variantsError;

    // Group variants by model
    const variantsByModel = variants.reduce((acc, variant) => {
      if (!acc[variant.parent_model_id]) {
        acc[variant.parent_model_id] = [];
      }
      acc[variant.parent_model_id].push(variant);
      return acc;
    }, {});

    // Add variants to models
    const modelsWithVariants = models.map(model => ({
      ...model,
      variants: variantsByModel[model.id] || []
    }));

    return modelsWithVariants;
  } catch (error) {
    console.error('Supabase get customer models with variants error:', error);
    return [];
  }
}

/**
 * Delete model variant
 */
export async function deleteModelVariant(variantId) {
  try {
    const { error } = await supabase
      .from('model_variants')
      .delete()
      .eq('id', variantId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Supabase delete variant error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Set primary variant for a model (only one can be primary)
 */
export async function setPrimaryVariant(modelId, variantId) {
  try {
    // First, unset all variants for this model as primary
    const { error: unsetError } = await supabase
      .from('model_variants')
      .update({ is_primary: false })
      .eq('parent_model_id', modelId);

    if (unsetError) throw unsetError;

    // Then set the specified variant as primary
    const { error: setPrimaryError } = await supabase
      .from('model_variants')
      .update({ is_primary: true })
      .eq('id', variantId);

    if (setPrimaryError) throw setPrimaryError;

    return { success: true };
  } catch (error) {
    console.error('Supabase set primary variant error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute a raw SQL query (Supabase compatible)
 */
export async function query(sql, params = []) {
  try {
    console.log('Executing query:', sql, params);
    
    // Handle user queries specifically
    if (sql.includes('SELECT') && sql.includes('users')) {
      if (sql.includes('SUM(m.view_count)')) {
        // This is the users with view counts query
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, username, role, customer_id, customer_name, is_active, created_at');
          
        if (usersError) throw usersError;
        
        // Get view counts for each customer
        const { data: models, error: modelsError } = await supabase
          .from('models')
          .select('customer_id, view_count');
          
        if (modelsError) throw modelsError;
        
        // Calculate total views per customer
        const viewCounts = {};
        models.forEach(model => {
          if (model.customer_id) {
            viewCounts[model.customer_id] = (viewCounts[model.customer_id] || 0) + (model.view_count || 0);
          }
        });
        
        // Add total_views to users
        const usersWithViews = users.map(user => ({
          ...user,
          total_views: user.role === 'customer' ? (viewCounts[user.customer_id] || 0) : 0
        }));
        
        return { success: true, data: usersWithViews };
      }
    }
    
    if (sql.includes('UPDATE users SET password_hash')) {
      const [hashedPassword, userId] = params;
      const { error } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', userId);
        
      if (error) throw error;
      return { success: true };
    }
    
    if (sql.includes('UPDATE users SET is_active = NOT is_active')) {
      const [userId] = params;
      
      // First get user info including username and role
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('is_active, username, role')
        .eq('id', userId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Protect admin users from deactivation
      if (user.username === 'admin' || user.role === 'admin') {
        throw new Error('Cannot deactivate admin user');
      }
      
      // Toggle the status
      const { error: updateError } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('id', userId);
        
      if (updateError) throw updateError;
      return { success: true };
    }
    
    // If we get here, it's an unsupported query
    throw new Error('Unsupported query type');
    
  } catch (error) {
    console.error('Query error:', error);
    return { success: false, error: error.message };
  }
}