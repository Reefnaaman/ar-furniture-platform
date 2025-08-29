import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { error } = await supabase.rpc('increment_view_count', { model_id: id });
    if (error) throw error;
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