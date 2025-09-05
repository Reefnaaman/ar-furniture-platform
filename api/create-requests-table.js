/**
 * Database table creation for customer requests feature
 * Run this endpoint to set up the customer_requests table
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    message: 'Please run the following SQL in your Supabase SQL editor to create the customer_requests table',
    sql: `
-- Create customer_requests table for the requests feature
CREATE TABLE IF NOT EXISTS customer_requests (
  id TEXT PRIMARY KEY,
  customer_id VARCHAR(100) NOT NULL,
  product_url TEXT NOT NULL,
  title VARCHAR(255),
  description TEXT,
  reference_images TEXT[], -- Array of Cloudinary image URLs
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high
  estimated_completion DATE,
  notes TEXT, -- Customer notes
  admin_notes TEXT, -- Admin-only notes
  model_id TEXT, -- References models(id) when completed
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_requests_customer ON customer_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON customer_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created ON customer_requests(created_at);

-- Add foreign key constraint for completed requests
ALTER TABLE customer_requests 
ADD CONSTRAINT fk_requests_model 
FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL;

-- Grant permissions
GRANT ALL ON customer_requests TO authenticated;
GRANT ALL ON customer_requests TO service_role;

-- Insert some sample data for testing (optional)
INSERT INTO customer_requests (id, customer_id, product_url, title, description, status) VALUES 
('req-sample-1', 'napo', 'https://example.com/product/chair', 'Modern Office Chair', 'Looking for a comfortable office chair with good back support', 'pending'),
('req-sample-2', 'napo', 'https://example.com/product/desk', 'Standing Desk', 'Need a height-adjustable standing desk', 'in_progress'),
('req-sample-3', 'napo', 'https://example.com/product/lamp', 'LED Table Lamp', 'Minimalist LED lamp for reading', 'completed');
    `,
    instructions: [
      '1. Go to your Supabase dashboard',
      '2. Navigate to SQL Editor',
      '3. Copy and paste the SQL above',
      '4. Click "Run" to create the customer_requests table',
      '5. The sample data is optional for testing the feature'
    ],
    endpoints_to_test: [
      'GET /api/create-requests-table - This endpoint (shows SQL)',
      'POST /api/requests - Submit new request (after implementing)',
      'GET /api/requests?customer=napo - Get customer requests (after implementing)'
    ]
  });
}