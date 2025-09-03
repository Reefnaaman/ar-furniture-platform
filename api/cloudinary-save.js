import { saveModel, saveModelVariant, getModel } from '../lib/supabase.js';

/**
 * Save model/variant metadata to database after successful Cloudinary direct upload
 * This is called AFTER the file has been uploaded directly from browser to Cloudinary
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, cloudinaryData, metadata } = req.body;
    
    if (!cloudinaryData || !cloudinaryData.secure_url) {
      return res.status(400).json({ error: 'Invalid Cloudinary upload data' });
    }

    console.log('💾 Saving to database:', { type, cloudinaryData, metadata });

    if (type === 'variant') {
      // Handle variant creation
      if (!metadata.modelId) {
        return res.status(400).json({ error: 'Model ID is required for variants' });
      }

      // Check if parent model exists
      const parentModel = await getModel(metadata.modelId);
      if (!parentModel) {
        return res.status(404).json({ error: 'Parent model not found' });
      }

      // Create variant in database
      const result = await saveModelVariant({
        parentModelId: metadata.modelId,
        variantName: metadata.variantName || 'Untitled Variant',
        cloudinaryUrl: cloudinaryData.secure_url,
        cloudinaryPublicId: cloudinaryData.public_id,
        hexColor: metadata.hexColor || '#000000',
        variantType: 'upload',
        fileSize: cloudinaryData.bytes || 0,
        isPrimary: metadata.isPrimary || false
      });

      if (!result.success) {
        console.error('❌ Database save failed:', result.error);
        return res.status(500).json({ 
          error: 'Failed to save variant to database',
          details: result.error 
        });
      }

      console.log('✅ Variant saved successfully:', result.id);
      return res.status(200).json({
        success: true,
        id: result.id,
        message: 'Variant created successfully'
      });

    } else if (type === 'model') {
      // Handle new model upload
      const result = await saveModel({
        title: metadata.title || metadata.filename?.replace(/\.(glb|gltf)$/i, '') || 'Untitled Model',
        description: metadata.description || '',
        filename: metadata.filename || cloudinaryData.original_filename || 'model.glb',
        cloudinaryUrl: cloudinaryData.secure_url,
        cloudinaryPublicId: cloudinaryData.public_id,
        fileSize: cloudinaryData.bytes || 0,
        customerId: metadata.customerId || 'unassigned',
        customerName: metadata.customerName || 'Unassigned',
        dominantColor: metadata.dominantColor || '#6b7280',
        metadata: {
          format: cloudinaryData.format || 'glb',
          resourceType: cloudinaryData.resource_type || 'raw',
          uploadedAt: new Date().toISOString(),
          originalFilename: cloudinaryData.original_filename || metadata.filename
        }
      });

      if (!result.success) {
        console.error('❌ Database save failed:', result.error);
        return res.status(500).json({ 
          error: 'Failed to save model to database',
          details: result.error 
        });
      }

      console.log('✅ Model saved successfully:', result.id);
      return res.status(200).json({
        success: true,
        id: result.id,
        message: 'Model uploaded successfully'
      });

    } else {
      return res.status(400).json({ error: 'Invalid upload type. Use "model" or "variant"' });
    }

  } catch (error) {
    console.error('❌ Error saving upload metadata:', error);
    res.status(500).json({ 
      error: 'Failed to save upload metadata',
      details: error.message 
    });
  }
}