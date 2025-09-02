import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Upload GLB file to Cloudinary
 * Free tier supports up to 100MB files
 */
export async function uploadModel(fileBuffer, filename) {
  return new Promise((resolve, reject) => {
    // Upload as raw file (GLB is not an image/video)
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: `furniture-models/${Date.now()}-${filename}`,
        format: 'glb',
        type: 'upload',
        access_mode: 'public',
        // Free tier allows files up to 100MB
        max_file_size: 100000000
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            size: result.bytes,
            format: result.format
          });
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Delete a model from Cloudinary
 */
export async function deleteModel(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw'
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
}

/**
 * Upload image file to Cloudinary (logos, brand assets, etc.)
 */
export async function uploadImage(fileBuffer, filename) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        public_id: `brand-assets/${Date.now()}-${filename}`,
        type: 'upload',
        access_mode: 'public',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ],
        max_file_size: 10000000 // 10MB for images
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary image upload error:', error);
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            size: result.bytes,
            format: result.format,
            width: result.width,
            height: result.height
          });
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Delete an image from Cloudinary
 */
export async function deleteImage(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image'
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete image error:', error);
    throw error;
  }
}

/**
 * Get Cloudinary usage stats (for monitoring free tier limits)
 */
export async function getUsageStats() {
  try {
    const result = await cloudinary.api.usage();
    return {
      storage: {
        used: result.storage.usage,
        limit: result.storage.limit || 25 * 1024 * 1024 * 1024, // 25GB free tier
        percentage: (result.storage.usage / (result.storage.limit || 25 * 1024 * 1024 * 1024)) * 100
      },
      bandwidth: {
        used: result.bandwidth.usage,
        limit: result.bandwidth.limit || 25 * 1024 * 1024 * 1024, // 25GB free tier
        percentage: (result.bandwidth.usage / (result.bandwidth.limit || 25 * 1024 * 1024 * 1024)) * 100
      }
    };
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return null;
  }
}

export default cloudinary;