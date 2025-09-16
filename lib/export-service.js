/**
 * Export Service for AR Furniture Platform
 * Generates customer integration kits with QR codes, URLs, and embed codes
 */

const { generateQR, generateBatchQR } = require('./qr-generator.js');

// Dynamic imports for Supabase functions to avoid ES module conflicts
async function getSupabaseFunctions() {
  try {
    // For Vercel serverless, this will work fine with ES modules
    const supabaseModule = await import('./supabase.js');
    return {
      getModelsByCustomerWithVariants: supabaseModule.getModelsByCustomerWithVariants,
      getCustomers: supabaseModule.getCustomers
    };
  } catch (error) {
    console.warn('Supabase functions not available in test environment:', error.message);
    return null;
  }
}

/**
 * Export format templates and configurations
 */
const EXPORT_FORMATS = {
  json: {
    name: 'JSON Data',
    mime_type: 'application/json',
    extension: 'json',
    description: 'Structured data for programmatic integration'
  },
  html: {
    name: 'HTML Integration Kit',
    mime_type: 'text/html',
    extension: 'html',
    description: 'Ready-to-use HTML page with embedded QR codes'
  },
  csv: {
    name: 'CSV Spreadsheet',
    mime_type: 'text/csv',
    extension: 'csv',
    description: 'Comma-separated values for spreadsheet applications'
  }
};

/**
 * Generate embed codes for different platforms
 */
function generateEmbedCodes(modelId, variantId = null, title = 'AR Model') {
  const baseUrl = process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://newfurniture.live';
  const arUrl = variantId ?
    `${baseUrl}/view?id=${modelId}&variant=${variantId}` :
    `${baseUrl}/view?id=${modelId}`;

  const iframeUrl = variantId ?
    `${baseUrl}/iframe_view.html?id=${modelId}&variant=${variantId}` :
    `${baseUrl}/iframe_view.html?id=${modelId}`;

  return {
    // Direct AR link
    direct_link: {
      url: arUrl,
      html: `<a href="${arUrl}" target="_blank" rel="noopener">View ${title} in AR</a>`,
      markdown: `[View ${title} in AR](${arUrl})`
    },

    // Button with styling
    styled_button: {
      html: `<a href="${arUrl}" target="_blank" rel="noopener" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-family: Arial, sans-serif; font-weight: 500;">📱 View ${title} in AR</a>`,
      css_class: 'ar-view-button'
    },

    // iFrame embed
    iframe: {
      html: `<iframe src="${iframeUrl}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`,
      responsive_html: `<div style="position: relative; padding-bottom: 75%; height: 0; overflow: hidden;"><iframe src="${iframeUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe></div>`
    },

    // Social sharing
    social: {
      whatsapp: `https://wa.me/?text=Check%20out%20this%20AR%20furniture:%20${encodeURIComponent(arUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(arUrl)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(arUrl)}&text=Check%20out%20this%20AR%20furniture!`,
      email: `mailto:?subject=AR%20Furniture:%20${encodeURIComponent(title)}&body=Check%20out%20this%20furniture%20in%20AR:%20${encodeURIComponent(arUrl)}`
    },

    // WordPress shortcode
    wordpress_shortcode: `[ar-furniture id="${modelId}"${variantId ? ` variant="${variantId}"` : ''} title="${title}"]`,

    // Shopify liquid
    shopify_liquid: `{{ '${arUrl}' | link_to: 'View in AR', class: 'ar-view-btn' }}`,

    // JSON-LD structured data
    json_ld: {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": title,
      "offers": {
        "@type": "Offer",
        "url": arUrl,
        "additionalProperty": {
          "@type": "PropertyValue",
          "name": "AR View",
          "value": "Available"
        }
      }
    }
  };
}

/**
 * Generate QR code with branding options
 */
async function generateBrandedQR(url, options = {}) {
  try {
    // Default branding options
    const qrOptions = {
      format: options.format || 'svg',
      size: options.size || 256,
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      margin: options.margin || 4,
      ...options
    };

    // Apply brand colors if provided
    if (options.brandColors) {
      qrOptions.color = {
        dark: options.brandColors.primary || '#000000',
        light: options.brandColors.background || '#FFFFFF'
      };
    }

    const result = await generateQR(url, qrOptions);
    return result;
  } catch (error) {
    console.error('Branded QR generation failed:', error);
    throw error;
  }
}

/**
 * Export customer models as JSON format
 */
async function exportAsJSON(customerId, options = {}) {
  try {
    // Get Supabase functions
    const supabase = await getSupabaseFunctions();
    if (!supabase) {
      throw new Error('Database functions not available');
    }

    // Get customer models with variants
    const models = await supabase.getModelsByCustomerWithVariants(customerId);

    if (!models || models.length === 0) {
      throw new Error(`No models found for customer: ${customerId}`);
    }

    // Get customer info
    const customers = await supabase.getCustomers();
    const customer = customers.find(c => c.id === customerId);

    const exportData = {
      export_info: {
        customer_id: customerId,
        customer_name: customer?.name || customerId,
        generated_at: new Date().toISOString(),
        format: 'json',
        total_models: models.length,
        qr_format: options.qr_format || 'svg',
        qr_size: options.qr_size || 256
      },
      models: []
    };

    // Process each model with its variants
    for (const model of models) {
      const modelData = {
        model_id: model.id,
        title: model.title,
        description: model.description || '',
        created_at: model.created_at,
        stats: {
          view_count: model.view_count || 0,
          file_size: model.file_size || 0
        }
      };

      // Generate QR for main model
      try {
        console.log(`🔍 Generating QR for model ${model.id} with options:`, {
          format: options.qr_format || 'svg',
          size: options.qr_size || 256,
          errorCorrectionLevel: options.qr_error_level || 'M'
        });
        const qrResult = await generateBrandedQR(
          `${process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://newfurniture.live'}/view?id=${model.id}`,
          {
            format: options.qr_format || 'svg',
            size: options.qr_size || 256,
            errorCorrectionLevel: options.qr_error_level || 'M',
            brandColors: options.brandColors
          }
        );

        modelData.qr_code = qrResult.data.qr_code;
        modelData.ar_url = qrResult.data.url;
        console.log(`✅ QR generated successfully for model ${model.id}`, {
          hasQrCode: !!qrResult.data.qr_code,
          qrLength: qrResult.data.qr_code?.length || 0
        });
      } catch (qrError) {
        console.warn(`Failed to generate QR for model ${model.id}:`, qrError.message);
        modelData.qr_code = null;
        modelData.ar_url = `${process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://newfurniture.live'}/view?id=${model.id}`;
      }

      // Generate embed codes
      modelData.embed_codes = generateEmbedCodes(model.id, null, model.title);

      // Process variants if they exist
      if (model.variants && model.variants.length > 0) {
        modelData.variants = [];

        for (const variant of model.variants) {
          const variantData = {
            variant_id: variant.id,
            name: variant.variant_name,
            hex_color: variant.hex_color,
            is_primary: variant.is_primary || false
          };

          // Generate QR for variant
          try {
            const variantQrResult = await generateBrandedQR(
              `${process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://newfurniture.live'}/view?id=${model.id}&variant=${variant.id}`,
              {
                format: options.qr_format || 'svg',
                size: options.qr_size || 256,
                errorCorrectionLevel: options.qr_error_level || 'M',
                brandColors: options.brandColors
              }
            );

            variantData.qr_code = variantQrResult.data.qr_code;
            variantData.ar_url = variantQrResult.data.url;
          } catch (qrError) {
            console.warn(`Failed to generate QR for variant ${variant.id}:`, qrError.message);
            variantData.qr_code = null;
            variantData.ar_url = `${process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://newfurniture.live'}/view?id=${model.id}&variant=${variant.id}`;
          }

          // Generate embed codes for variant
          variantData.embed_codes = generateEmbedCodes(model.id, variant.id, `${model.title} - ${variant.variant_name}`);

          modelData.variants.push(variantData);
        }
      }

      exportData.models.push(modelData);
    }

    return {
      content: JSON.stringify(exportData, null, 2),
      filename: `${customerId}-integration-kit-${Date.now()}.json`,
      mime_type: 'application/json',
      size: JSON.stringify(exportData).length
    };

  } catch (error) {
    console.error('JSON export failed:', error);
    throw new Error(`Failed to export JSON: ${error.message}`);
  }
}

/**
 * Export customer models as HTML format
 */
async function exportAsHTML(customerId, options = {}) {
  try {
    // Get JSON data first
    const jsonData = await exportAsJSON(customerId, options);
    const data = JSON.parse(jsonData.content);

    const customerName = data.export_info.customer_name;
    const totalModels = data.export_info.total_models;

    // Generate comprehensive HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AR Integration Kit - ${customerName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #2d3748;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            backdrop-filter: blur(10px);
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            color: #2d3748;
            padding: 3rem 2rem;
            border-radius: 20px;
            margin-bottom: 2rem;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .header h1 {
            font-size: 3rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-weight: 800;
        }

        .header p {
            font-size: 1.2rem;
            color: #718096;
            font-weight: 500;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            padding: 2rem 1.5rem;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center;
            transition: all 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }

        .stat-value {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.5rem;
        }

        .model-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .model-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .model-card:hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
        }

        .model-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem 1.5rem;
            position: relative;
        }

        .model-header::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%);
            pointer-events: none;
        }

        .model-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }

        .model-description {
            opacity: 0.9;
        }

        .model-content {
            padding: 1.5rem;
        }

        .qr-section {
            display: flex;
            align-items: center;
            gap: 1.5rem;
            margin-bottom: 1.5rem;
            padding: 1.5rem;
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            transition: all 0.3s ease;
        }

        .qr-section:hover {
            background: rgba(255, 255, 255, 0.9);
            transform: translateY(-2px);
        }

        .qr-code {
            flex-shrink: 0;
        }

        .qr-info {
            flex-grow: 1;
        }

        .ar-url {
            font-family: monospace;
            font-size: 0.9rem;
            color: #666;
            word-break: break-all;
            margin-bottom: 0.5rem;
        }

        .embed-section {
            margin-bottom: 1.5rem;
        }

        .embed-section h4 {
            color: #667eea;
            margin-bottom: 1rem;
            font-size: 1.1rem;
        }

        .code-block {
            background: rgba(45, 55, 72, 0.95);
            color: #a0aec0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 1.2rem;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            font-size: 0.85rem;
            margin-bottom: 0.8rem;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-all;
            backdrop-filter: blur(10px);
            position: relative;
        }

        .code-block::before {
            content: 'CODE';
            position: absolute;
            top: 8px;
            right: 12px;
            font-size: 0.7rem;
            color: #4a5568;
            font-weight: 600;
        }

        .copy-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 0.7rem 1.2rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            margin-top: 0.5rem;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .copy-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }

        .copy-btn:active {
            transform: translateY(0px);
        }

        .variants-section {
            margin-top: 1.5rem;
            border-top: 2px solid #e2e8f0;
            padding-top: 1.5rem;
        }

        .variant-item {
            display: flex;
            align-items: center;
            gap: 1.5rem;
            margin-bottom: 1rem;
            padding: 1.5rem;
            background: rgba(255, 255, 255, 0.6);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s ease;
        }

        .variant-item:hover {
            background: rgba(255, 255, 255, 0.8);
            transform: translateX(5px);
        }

        .variant-color {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 3px solid rgba(255, 255, 255, 0.8);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            flex-shrink: 0;
            transition: all 0.3s ease;
        }

        .variant-color:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        .variant-qr {
            flex-shrink: 0;
        }

        .variant-info {
            flex-grow: 1;
        }

        .variant-name {
            font-weight: 600;
            margin-bottom: 0.3rem;
        }

        .footer {
            text-align: center;
            padding: 2rem;
            color: #666;
            border-top: 1px solid #e2e8f0;
            margin-top: 3rem;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }

            .model-grid {
                grid-template-columns: 1fr;
            }

            .qr-section {
                flex-direction: column;
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>🏠 AR Integration Kit</h1>
            <p>Complete integration package for ${customerName}</p>
        </header>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${totalModels}</div>
                <div>Total Models</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.models.reduce((sum, m) => sum + (m.variants ? m.variants.length : 0), 0)}</div>
                <div>Variants</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.export_info.qr_format.toUpperCase()}</div>
                <div>QR Format</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.export_info.qr_size}px</div>
                <div>QR Size</div>
            </div>
        </div>

        <div class="model-grid">
            ${data.models.map(model => `
                <div class="model-card">
                    <div class="model-header">
                        <div class="model-title">${model.title}</div>
                        <div class="model-description">${model.description}</div>
                    </div>

                    <div class="model-content">
                        <!-- Main Model QR -->
                        <div class="qr-section">
                            <div class="qr-code">
                                ${model.qr_code || '<div style="width:100px;height:100px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;">No QR</div>'}
                            </div>
                            <div class="qr-info">
                                <div class="ar-url">${model.ar_url}</div>
                                <button class="copy-btn" onclick="copyToClipboard('${model.ar_url}')">Copy URL</button>
                            </div>
                        </div>

                        <!-- Embed Codes -->
                        <div class="embed-section">
                            <h4>Direct Link (HTML)</h4>
                            <div class="code-block">${model.embed_codes.direct_link.html}</div>
                            <button class="copy-btn" onclick="copyToClipboard(\`${model.embed_codes.direct_link.html}\`)">Copy HTML</button>

                            <h4>Styled Button</h4>
                            <div class="code-block">${model.embed_codes.styled_button.html}</div>
                            <button class="copy-btn" onclick="copyToClipboard(\`${model.embed_codes.styled_button.html}\`)">Copy Button</button>

                            <h4>iFrame Embed</h4>
                            <div class="code-block">${model.embed_codes.iframe.html}</div>
                            <button class="copy-btn" onclick="copyToClipboard(\`${model.embed_codes.iframe.html}\`)">Copy iFrame</button>
                        </div>

                        ${model.variants && model.variants.length > 0 ? `
                            <div class="variants-section">
                                <h4>Color Variants</h4>
                                ${model.variants.map(variant => `
                                    <div class="variant-item">
                                        <div class="variant-color" style="background-color: ${variant.hex_color}"></div>
                                        <div class="variant-qr">
                                            ${variant.qr_code || '<div style="width:60px;height:60px;background:#f0f0f0;"></div>'}
                                        </div>
                                        <div class="variant-info">
                                            <div class="variant-name">${variant.name} ${variant.is_primary ? '⭐' : ''}</div>
                                            <div class="ar-url">${variant.ar_url}</div>
                                            <button class="copy-btn" onclick="copyToClipboard('${variant.ar_url}')">Copy</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <footer class="footer">
            <p>Generated on ${new Date(data.export_info.generated_at).toLocaleString()}</p>
            <p>AR Integration Kit for ${customerName}</p>
        </footer>
    </div>

    <script>
        // Enhanced copy functionality with visual feedback
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(function() {
                showToast('✅ Copied to clipboard!', 'success');
            }).catch(function(err) {
                console.error('Failed to copy: ', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showToast('✅ Copied to clipboard!', 'success');
            });
        }

        // Toast notification system
        function showToast(message, type = 'info') {
            // Remove existing toasts
            const existingToasts = document.querySelectorAll('.toast');
            existingToasts.forEach(toast => toast.remove());

            const toast = document.createElement('div');
            toast.className = \`toast toast-\${type}\`;
            toast.textContent = message;

            Object.assign(toast.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                padding: '12px 24px',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                zIndex: '10000',
                transform: 'translateX(100%)',
                transition: 'transform 0.3s ease',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(10px)'
            });

            if (type === 'success') {
                toast.style.background = 'linear-gradient(135deg, #48bb78, #38a169)';
            } else if (type === 'error') {
                toast.style.background = 'linear-gradient(135deg, #f56565, #e53e3e)';
            } else {
                toast.style.background = 'linear-gradient(135deg, #4299e1, #3182ce)';
            }

            document.body.appendChild(toast);

            // Animate in
            setTimeout(() => {
                toast.style.transform = 'translateX(0)';
            }, 10);

            // Auto remove
            setTimeout(() => {
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // Download QR codes as files
        function downloadQR(svgContent, filename) {
            try {
                const blob = new Blob([svgContent], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename + '.svg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('📱 QR code downloaded!', 'success');
            } catch (err) {
                console.error('Download failed:', err);
                showToast('❌ Download failed', 'error');
            }
        }

        // Print functionality
        function printPage() {
            const printCSS = \`
                @media print {
                    body { background: white !important; }
                    .copy-btn { display: none !important; }
                    .model-card { break-inside: avoid; margin-bottom: 2rem; }
                    .qr-section { background: #f8f9fa !important; }
                    .variant-item { background: #f8f9fa !important; }
                }
            \`;
            const style = document.createElement('style');
            style.textContent = printCSS;
            document.head.appendChild(style);

            window.print();

            setTimeout(() => document.head.removeChild(style), 1000);
        }

        // Search and filter functionality
        function setupSearch() {
            const searchInput = document.createElement('input');
            searchInput.placeholder = '🔍 Search models...';
            searchInput.style.cssText = \`
                width: 100%;
                max-width: 400px;
                padding: 12px 20px;
                border: 1px solid rgba(255,255,255,0.3);
                border-radius: 25px;
                background: rgba(255,255,255,0.9);
                backdrop-filter: blur(10px);
                font-size: 16px;
                margin-bottom: 2rem;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            \`;

            const container = document.querySelector('.container');
            const modelGrid = document.querySelector('.model-grid');
            container.insertBefore(searchInput, modelGrid);

            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const cards = document.querySelectorAll('.model-card');

                cards.forEach(card => {
                    const title = card.querySelector('.model-title').textContent.toLowerCase();
                    const description = card.querySelector('.model-description').textContent.toLowerCase();

                    if (title.includes(query) || description.includes(query)) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }

        // Initialize enhanced features
        document.addEventListener('DOMContentLoaded', function() {
            setupSearch();

            // Add print button to header
            const headerActions = document.createElement('div');
            headerActions.style.cssText = 'margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;';

            const printBtn = document.createElement('button');
            printBtn.innerHTML = '🖨️ Print Kit';
            printBtn.onclick = printPage;
            printBtn.style.cssText = \`
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            \`;
            printBtn.onmouseover = () => printBtn.style.transform = 'translateY(-2px)';
            printBtn.onmouseout = () => printBtn.style.transform = 'translateY(0)';

            headerActions.appendChild(printBtn);
            document.querySelector('.header').appendChild(headerActions);

            // Animate elements on load
            const cards = document.querySelectorAll('.model-card');
            cards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    card.style.transition = 'all 0.6s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, index * 100);
            });

            showToast('🏠 AR Integration Kit loaded successfully!', 'success');
        });
    </script>
</body>
</html>`;

    return {
      content: html,
      filename: `${customerId}-integration-kit-${Date.now()}.html`,
      mime_type: 'text/html',
      size: html.length
    };

  } catch (error) {
    console.error('HTML export failed:', error);
    throw new Error(`Failed to export HTML: ${error.message}`);
  }
}

/**
 * Export customer models as CSV format
 */
async function exportAsCSV(customerId, options = {}) {
  try {
    // Get JSON data first
    const jsonData = await exportAsJSON(customerId, options);
    const data = JSON.parse(jsonData.content);

    // Enhanced CSV Headers with comprehensive data
    const headers = [
      '📦 Model ID',
      '📋 Title',
      '📝 Description',
      '🔗 AR URL',
      '📱 QR Code Data',
      '🌐 Direct Link HTML',
      '🎯 Button HTML',
      '📺 iFrame HTML',
      '🎨 Variant ID',
      '🏷️ Variant Name',
      '🎨 Variant Color (Hex)',
      '🔗 Variant AR URL',
      '📱 Variant QR Code',
      '👁️ View Count',
      '💾 File Size (MB)',
      '📅 Created Date',
      '📊 Export Date',
      '🏢 Customer Name',
      '⚙️ QR Settings',
      '📋 Integration Notes'
    ];

    const rows = [headers];

    // Process each model with enhanced data
    const exportDate = new Date().toISOString().split('T')[0];
    const qrSettings = `${data.export_info.qr_size}px, ${data.export_info.qr_format}, ${data.export_info.error_correction}`;

    for (const model of data.models) {
      // Main model row with comprehensive data
      rows.push([
        model.model_id,
        `"${model.title.replace(/"/g, '""')}"`,
        `"${model.description.replace(/"/g, '""')}"`,
        model.ar_url,
        model.qr_code ? `"QR Code Available (${data.export_info.qr_format})"` : 'No QR Code',
        `"${model.embed_codes.direct_link.html.replace(/"/g, '""')}"`,
        `"${model.embed_codes.styled_button.html.replace(/"/g, '""')}"`,
        `"${model.embed_codes.iframe.html.replace(/"/g, '""')}"`,
        '', // No variant for main model
        '', // No variant name
        '', // No variant color
        '', // No variant URL
        '', // No variant QR
        model.stats.view_count || 0,
        model.stats.file_size_mb ? `${model.stats.file_size_mb}` : '0',
        model.created_at || '',
        exportDate,
        `"${data.export_info.customer_name.replace(/"/g, '""')}"`,
        `"${qrSettings}"`,
        `"Main model - Use AR URL for direct viewing"`
      ]);

      // Variant rows
      if (model.variants && model.variants.length > 0) {
        for (const variant of model.variants) {
          rows.push([
            model.model_id,
            `"${model.title.replace(/"/g, '""')}"`,
            `"${model.description.replace(/"/g, '""')}"`,
            model.ar_url,
            model.qr_code ? `"QR Code Available (${data.export_info.qr_format})"` : 'No QR Code',
            `"${model.embed_codes.direct_link.html.replace(/"/g, '""')}"`,
            `"${model.embed_codes.styled_button.html.replace(/"/g, '""')}"`,
            `"${model.embed_codes.iframe.html.replace(/"/g, '""')}"`,
            variant.variant_id || '',
            `"${variant.name ? variant.name.replace(/"/g, '""') : ''}"`,
            variant.hex_color || '',
            variant.ar_url || '',
            variant.qr_code ? `"Variant QR Available (${data.export_info.qr_format})"` : 'No Variant QR',
            model.stats.view_count || 0,
            model.stats.file_size_mb ? `${model.stats.file_size_mb}` : '0',
            model.created_at || '',
            exportDate,
            `"${data.export_info.customer_name.replace(/"/g, '""')}"`,
            `"${qrSettings}"`,
            `"Variant: ${variant.name || 'Unnamed'} - Color: ${variant.hex_color || 'No color'}"`
          ]);
        }
      }
    }

    // Add CSV metadata header
    const metadataRows = [
      [`# AR Integration Kit Export - ${data.export_info.customer_name}`],
      [`# Generated: ${new Date().toISOString()}`],
      [`# Models: ${data.export_info.total_models}`],
      [`# QR Format: ${data.export_info.qr_format} (${data.export_info.qr_size}px)`],
      [`# This file contains comprehensive AR integration data`],
      [''], // Empty row separator
    ];

    // Combine metadata and data
    const allRows = [...metadataRows, ...rows];

    // Convert to CSV string with proper formatting
    const csvContent = allRows.map(row => row.join(',')).join('\n');

    // Calculate statistics
    const totalVariants = data.models.reduce((sum, m) => sum + (m.variants ? m.variants.length : 0), 0);
    const customerNameSafe = data.export_info.customer_name.replace(/[^a-zA-Z0-9]/g, '_');

    return {
      content: csvContent,
      filename: `${customerNameSafe}_AR_Integration_Kit_${exportDate}.csv`,
      mime_type: 'text/csv',
      size: csvContent.length,
      metadata: {
        models_count: data.export_info.total_models,
        variants_count: totalVariants,
        qr_format: data.export_info.qr_format,
        export_date: exportDate,
        customer: data.export_info.customer_name
      }
    };

  } catch (error) {
    console.error('CSV export failed:', error);
    throw new Error(`Failed to export CSV: ${error.message}`);
  }
}

/**
 * Main export function that handles different formats
 */
async function exportCustomerKit(customerId, format = 'json', options = {}) {
  try {
    // Validate format
    if (!EXPORT_FORMATS[format]) {
      throw new Error(`Unsupported export format: ${format}. Supported formats: ${Object.keys(EXPORT_FORMATS).join(', ')}`);
    }

    // Default options
    const exportOptions = {
      qr_format: 'svg',
      qr_size: 256,
      include_variants: true,
      brandColors: null,
      ...options
    };

    let result;

    // Export based on format
    switch (format) {
      case 'json':
        result = await exportAsJSON(customerId, exportOptions);
        break;
      case 'html':
        result = await exportAsHTML(customerId, exportOptions);
        break;
      case 'csv':
        result = await exportAsCSV(customerId, exportOptions);
        break;
      default:
        throw new Error(`Format ${format} not implemented`);
    }

    // Add metadata
    result.format = format;
    result.generated_at = new Date().toISOString();
    result.customer_id = customerId;
    result.options = exportOptions;

    return result;

  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

/**
 * Get available export formats and their capabilities
 */
function getExportFormats() {
  return {
    formats: EXPORT_FORMATS,
    default_options: {
      qr_format: 'svg',
      qr_size: 256,
      include_variants: true,
      brandColors: null
    },
    supported_qr_formats: ['svg', 'png', 'dataurl'],
    supported_qr_sizes: [64, 128, 200, 256, 512, 1024]
  };
}

module.exports = {
  exportCustomerKit,
  exportAsJSON,
  exportAsHTML,
  exportAsCSV,
  generateEmbedCodes,
  generateBrandedQR,
  getExportFormats,
  EXPORT_FORMATS
};