/**
 * QR Code URL handler for SEO-friendly URLs with dynamic routing
 * Handles routes like: /api/qr/{customer}/{product-slug-id.svg}
 * Handles routes like: /api/qr/{customer}/{product-slug-id-variant.svg}
 */

import { resolveUrlToModel } from '../../lib/supabase.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache QR codes for 1 hour

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get dynamic route parameters - different parsing approaches
    let customerSlug, filenamePart;

    // Method 1: Try req.query.params (Vercel dynamic routes)
    if (req.query.params && Array.isArray(req.query.params)) {
      [customerSlug, filenamePart] = req.query.params;
    } else {
      // Method 2: Parse from URL path manually
      const { pathname } = new URL(req.url, `https://${req.headers.host}`);
      const pathParts = pathname.split('/').filter(Boolean); // ['qr', 'customer', 'product.svg']

      if (pathParts.length !== 3) {
        return res.status(400).json({
          error: 'Invalid QR URL format. Expected: /qr/{customer}/{product}.svg',
          debug: { pathname, pathParts, query: req.query }
        });
      }

      [, customerSlug, filenamePart] = pathParts;
    }

    // Remove .svg extension
    if (!filenamePart.endsWith('.svg')) {
      return res.status(400).json({ error: 'QR URLs must end with .svg' });
    }

    const productPart = filenamePart.replace('.svg', '');

    // Check if this includes a variant (format: product-slug-id-variant)
    let productSlugWithId, variantSlug;

    // Try to match pattern: product-slug-ID-variant
    const variantMatch = productPart.match(/^(.+-[a-zA-Z0-9_-]{8})-(.+)$/);
    if (variantMatch) {
      [, productSlugWithId, variantSlug] = variantMatch;
    } else {
      // No variant, just product-slug-ID
      productSlugWithId = productPart;
      variantSlug = null;
    }

    console.log('🔍 QR URL Resolution:', { customerSlug, productSlugWithId, variantSlug });

    // Resolve URL to model data
    const resolution = await resolveUrlToModel(customerSlug, productSlugWithId, variantSlug);

    if (!resolution.success) {
      console.log('❌ QR URL resolution failed:', resolution.error);
      return res.status(404).json({ error: resolution.error });
    }

    const { model } = resolution;

    // Build the target URL for QR code
    const domain = process.env.DOMAIN || 'https://newfurniture.live';
    let targetUrl = `${domain}/f/${customerSlug}/${productSlugWithId}`;
    if (variantSlug) {
      targetUrl += `/${variantSlug}`;
    }

    console.log('🔲 Generating QR for URL:', targetUrl);

    // Redirect to QR generation endpoint with the SEO URL
    const qrUrl = `/api/u4?url=${encodeURIComponent(targetUrl)}&format=svg&size=256&raw=true`;

    res.writeHead(302, { Location: qrUrl });
    return res.end();

  } catch (error) {
    console.error('❌ QR URL handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}