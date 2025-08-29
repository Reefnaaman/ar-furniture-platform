import { sql } from '@vercel/postgres';
import { nanoid } from 'nanoid';

/**
 * Initialize database tables
 */
export async function initDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS models (
        id VARCHAR(10) PRIMARY KEY,
        title VARCHAR(255),
        description TEXT,
        filename VARCHAR(255),
        cloudinary_url TEXT,
        cloudinary_public_id VARCHAR(255),
        file_size BIGINT,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        view_count INT DEFAULT 0,
        metadata JSONB
      );
    `;
    return { success: true };
  } catch (error) {
    console.error('Database init error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save model to database
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
  const id = nanoid(8); // Generate 8-character ID
  
  try {
    await sql`
      INSERT INTO models (
        id, title, description, filename, 
        cloudinary_url, cloudinary_public_id, 
        file_size, metadata
      ) VALUES (
        ${id},
        ${title || filename},
        ${description || ''},
        ${filename},
        ${cloudinaryUrl},
        ${cloudinaryPublicId},
        ${fileSize},
        ${JSON.stringify(metadata)}
      );
    `;
    
    return { id, success: true };
  } catch (error) {
    console.error('Database save error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get model by ID
 */
export async function getModel(id) {
  try {
    const result = await sql`
      SELECT * FROM models WHERE id = ${id};
    `;
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const model = result.rows[0];
    
    // Parse JSON metadata if it's a string
    if (typeof model.metadata === 'string') {
      model.metadata = JSON.parse(model.metadata);
    }
    
    return model;
  } catch (error) {
    console.error('Database get error:', error);
    return null;
  }
}

/**
 * Increment view count
 */
export async function incrementViewCount(id) {
  try {
    await sql`
      UPDATE models SET view_count = view_count + 1 WHERE id = ${id};
    `;
    return { success: true };
  } catch (error) {
    console.error('Database update error:', error);
    return { success: false };
  }
}

/**
 * Get all models (for admin)
 */
export async function getAllModels(limit = 100, offset = 0) {
  try {
    const result = await sql`
      SELECT * FROM models ORDER BY upload_date DESC LIMIT ${limit} OFFSET ${offset};
    `;
    
    return result.rows.map(model => {
      if (typeof model.metadata === 'string') {
        model.metadata = JSON.parse(model.metadata);
      }
      return model;
    });
  } catch (error) {
    console.error('Database list error:', error);
    return [];
  }
}

/**
 * Delete model
 */
export async function deleteModel(id) {
  try {
    await sql`
      DELETE FROM models WHERE id = ${id};
    `;
    return { success: true };
  } catch (error) {
    console.error('Database delete error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get statistics
 */
export async function getStats() {
  try {
    const totalModels = await sql`SELECT COUNT(*) as count FROM models;`;
    const totalViews = await sql`SELECT SUM(view_count) as total FROM models;`;
    const totalSize = await sql`SELECT SUM(file_size) as total FROM models;`;
    
    return {
      totalModels: totalModels.rows[0]?.count || 0,
      totalViews: totalViews.rows[0]?.total || 0,
      totalSize: totalSize.rows[0]?.total || 0
    };
  } catch (error) {
    console.error('Database stats error:', error);
    return {
      totalModels: 0,
      totalViews: 0,
      totalSize: 0
    };
  }
}