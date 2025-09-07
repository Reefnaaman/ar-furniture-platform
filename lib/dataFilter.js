/**
 * Data filtering utilities to hide internal fields from client responses
 * Prevents exposure of sensitive database structure and business logic
 */

// Define allowed fields for each data type
const ALLOWED_FIELDS = {
  model: [
    'id',
    'title', 
    'description',
    'filename',
    'file_size',
    'upload_date',
    'view_count',
    'dominant_color'
    // Hide: cloudinary_public_id, customer_id, customer_name, metadata details
  ],
  
  model_full: [
    'id',
    'title',
    'description', 
    'filename',
    'file_size',
    'upload_date',
    'view_count',
    'dominant_color',
    'customer_id',
    'customer_name'
    // Still hide: cloudinary_public_id, detailed metadata
  ],
  
  variant: [
    'id',
    'variant_name',
    'hex_color',
    'is_primary',
    'cloudinary_url' // Needed for variant switching
    // Hide: cloudinary_public_id, parent_model_id details, variant_type
  ],
  
  customer: [
    'id',
    'name',
    'count'
    // Hide: internal IDs, metadata
  ],
  
  user: [
    'id',
    'username',
    'role',
    'is_active',
    'created_at'
    // Hide: password_hash, customer_id details, internal flags
  ],
  
  image: [
    'id',
    'filename',
    'cloudinary_url',
    'file_size',
    'width',
    'height',
    'format',
    'image_type'
    // Hide: cloudinary_public_id, customer_id, metadata
  ],
  
  feedback: [
    'id',
    'feedback_type',
    'categories', 
    'comment',
    'model_name',
    'created_at'
    // Hide: customer_id, model_id, user_agent, internal tracking
  ]
};

/**
 * Filter a single object to only include allowed fields
 */
function filterObject(obj, allowedFields) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const filtered = {};
  allowedFields.forEach(field => {
    if (obj.hasOwnProperty(field)) {
      filtered[field] = obj[field];
    }
  });
  
  return filtered;
}

/**
 * Filter an array of objects
 */
function filterArray(array, allowedFields) {
  if (!Array.isArray(array)) return array;
  return array.map(item => filterObject(item, allowedFields));
}

/**
 * Filter model data for public consumption
 */
export function filterModel(model, includeCustomerInfo = false) {
  const fields = includeCustomerInfo ? ALLOWED_FIELDS.model_full : ALLOWED_FIELDS.model;
  return filterObject(model, fields);
}

/**
 * Filter models array for public consumption  
 */
export function filterModels(models, includeCustomerInfo = false) {
  const fields = includeCustomerInfo ? ALLOWED_FIELDS.model_full : ALLOWED_FIELDS.model;
  return filterArray(models, fields);
}

/**
 * Filter model with variants for public consumption
 */
export function filterModelWithVariants(model, includeCustomerInfo = false) {
  const filteredModel = filterModel(model, includeCustomerInfo);
  
  if (model.variants && Array.isArray(model.variants)) {
    filteredModel.variants = filterArray(model.variants, ALLOWED_FIELDS.variant);
  }
  
  return filteredModel;
}

/**
 * Filter models with variants array
 */
export function filterModelsWithVariants(models, includeCustomerInfo = false) {
  if (!Array.isArray(models)) return models;
  return models.map(model => filterModelWithVariants(model, includeCustomerInfo));
}

/**
 * Filter customer data
 */
export function filterCustomer(customer) {
  return filterObject(customer, ALLOWED_FIELDS.customer);
}

/**
 * Filter customers array
 */
export function filterCustomers(customers) {
  return filterArray(customers, ALLOWED_FIELDS.customer);
}

/**
 * Filter user data (admin only should see full user info)
 */
export function filterUser(user, isAdmin = false) {
  const fields = isAdmin ? ALLOWED_FIELDS.user : ['id', 'username', 'role'];
  return filterObject(user, fields);
}

/**
 * Filter users array
 */
export function filterUsers(users, isAdmin = false) {
  const fields = isAdmin ? ALLOWED_FIELDS.user : ['id', 'username', 'role'];
  return filterArray(users, fields);
}

/**
 * Filter image data
 */
export function filterImage(image) {
  return filterObject(image, ALLOWED_FIELDS.image);
}

/**
 * Filter images array
 */
export function filterImages(images) {
  return filterArray(images, ALLOWED_FIELDS.image);
}

/**
 * Filter feedback data
 */
export function filterFeedback(feedback) {
  return filterObject(feedback, ALLOWED_FIELDS.feedback);
}

/**
 * Filter feedback array
 */
export function filterFeedbackArray(feedbackArray) {
  return filterArray(feedbackArray, ALLOWED_FIELDS.feedback);
}

/**
 * Remove sensitive metadata fields
 */
export function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};
  
  // Only allow safe metadata fields
  const allowedMetadata = {};
  const safeFields = ['uploadedAt', 'originalName', 'customerName'];
  
  safeFields.forEach(field => {
    if (metadata[field]) {
      allowedMetadata[field] = metadata[field];
    }
  });
  
  return allowedMetadata;
}