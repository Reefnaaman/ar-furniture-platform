/**
 * SEO-friendly furniture URL handler with dynamic routing
 * Handles routes like: /api/f/{customer}/{product-slug-id}
 * Handles routes like: /api/f/{customer}/{product-slug-id}/{variant}
 */

import { resolveUrlToModel } from '../../lib/supabase.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get dynamic route parameters - different parsing approaches
    let customerSlug, productSlugWithId, variantSlug;

    // Method 1: Try req.query.params (Vercel dynamic routes)
    if (req.query.params && Array.isArray(req.query.params)) {
      [customerSlug, productSlugWithId, variantSlug] = req.query.params;
    } else {
      // Method 2: Parse from URL path manually
      const { pathname } = new URL(req.url, `https://${req.headers.host}`);
      const pathParts = pathname.split('/').filter(Boolean); // ['f', 'customer', 'product', 'variant?']

      if (pathParts.length < 3) {
        return res.status(400).json({
          error: 'Invalid URL format. Expected: /f/{customer}/{product}',
          debug: { pathname, pathParts, query: req.query }
        });
      }

      [, customerSlug, productSlugWithId, variantSlug] = pathParts;
    }

    console.log('🔍 SEO URL Resolution:', {
      customerSlug,
      productSlugWithId,
      variantSlug,
      url: req.url,
      query: req.query
    });

    // Resolve URL to model data
    const resolution = await resolveUrlToModel(customerSlug, productSlugWithId, variantSlug);

    if (!resolution.success) {
      console.log('❌ URL resolution failed:', resolution.error);
      return res.status(404).json({ error: resolution.error });
    }

    const { model } = resolution;

    // Build the redirect URL to the current view.html system
    let redirectUrl = `/view?id=${model.id}`;
    if (variantSlug) {
      // Find variant by slug (for now, we'll search variants by name)
      redirectUrl += `&variant=${variantSlug}`;
    }

    console.log('✅ Redirecting to:', redirectUrl);

    // Redirect to existing view system (301 for SEO)
    res.writeHead(301, { Location: redirectUrl });
    return res.end();

  } catch (error) {
    console.error('❌ SEO URL handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}