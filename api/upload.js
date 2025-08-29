import { uploadModel } from '../lib/cloudinary.js';
import { saveModel, initDatabase } from '../lib/database.js';

export const config = {
  api: {
    bodyParser: false
  }
};

/**
 * Handle file upload
 * POST /api/upload
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
    // Ensure database is initialized
    await initDatabase();
    
    // Parse multipart form data
    const { file, title, description } = await parseFormData(req);
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Validate file type
    if (!file.originalname.match(/\.(glb|gltf)$/i)) {
      return res.status(400).json({ error: 'Only GLB and GLTF files are allowed' });
    }

    // Check file size (100MB max for free Cloudinary)
    if (file.buffer.length > 100 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB' });
    }

    // Upload to Cloudinary
    console.log('Uploading to Cloudinary...');
    const cloudinaryResult = await uploadModel(file.buffer, file.originalname);

    // Save to database
    console.log('Saving to database...');
    const dbResult = await saveModel({
      title: title || file.originalname.replace(/\.(glb|gltf)$/i, ''),
      description: description || '',
      filename: file.originalname,
      cloudinaryUrl: cloudinaryResult.url,
      cloudinaryPublicId: cloudinaryResult.publicId,
      fileSize: cloudinaryResult.size,
      metadata: {
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString()
      }
    });

    if (!dbResult.success) {
      return res.status(500).json({ error: 'Failed to save model to database' });
    }

    // Return success with URLs
    const modelId = dbResult.id;
    const domain = process.env.DOMAIN || 'newfurniture.live';
    
    res.status(200).json({
      success: true,
      id: modelId,
      viewUrl: `https://${domain}/view?id=${modelId}`,
      directUrl: cloudinaryResult.url,
      shareUrl: `https://${domain}/view?id=${modelId}`,
      title: title || file.originalname,
      fileSize: cloudinaryResult.size,
      message: 'Model uploaded successfully!'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Upload failed', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Parse multipart form data
 */
async function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const boundary = req.headers['content-type'].split('boundary=')[1];
    
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const parts = parseMultipart(buffer, boundary);
      
      let file = null;
      let title = '';
      let description = '';
      
      for (const part of parts) {
        if (part.name === 'file' && part.filename) {
          file = {
            buffer: part.data,
            originalname: part.filename,
            mimetype: part.contentType || 'model/gltf-binary'
          };
        } else if (part.name === 'title') {
          title = part.data.toString('utf-8');
        } else if (part.name === 'description') {
          description = part.data.toString('utf-8');
        }
      }
      
      resolve({ file, title, description });
    });
    req.on('error', reject);
  });
}

/**
 * Parse multipart data
 */
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
  
  let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length + 2; // Skip boundary and CRLF
  
  while (start < buffer.length) {
    const nextBoundary = buffer.indexOf(boundaryBuffer, start);
    const endBoundary = buffer.indexOf(endBoundaryBuffer, start);
    
    let end = nextBoundary !== -1 ? nextBoundary : endBoundary;
    if (end === -1) break;
    
    const partData = buffer.slice(start, end - 2); // Remove CRLF before boundary
    
    // Parse headers
    const headerEnd = partData.indexOf('\r\n\r\n');
    const headers = partData.slice(0, headerEnd).toString('utf-8');
    const data = partData.slice(headerEnd + 4);
    
    // Extract name and filename
    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type: (.+)/);
    
    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch ? filenameMatch[1] : null,
        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : null,
        data: data
      });
    }
    
    if (end === endBoundary) break;
    start = end + boundaryBuffer.length + 2;
  }
  
  return parts;
}