/**
 * Database table creation for feedback feature
 * Run this endpoint to set up the feedback table
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    message: 'Please run the following SQL in your Supabase SQL editor to create the feedback table',
    sql: `
-- Create feedback table for the feedback feature
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  categories TEXT[] DEFAULT '{}',
  comment TEXT,
  customer_id VARCHAR(100) NOT NULL,
  model_id TEXT NOT NULL,
  model_name VARCHAR(255),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_feedback_customer ON feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_model ON feedback(model_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);

-- Grant permissions
GRANT ALL ON feedback TO authenticated;
GRANT ALL ON feedback TO service_role;

-- Insert some sample data for testing (optional)
INSERT INTO feedback (id, feedback_type, comment, customer_id, model_id, model_name) VALUES 
('feedback-sample-1', 'positive', 'Great quality furniture, very happy with the purchase!', 'napo', 'model-123', 'Modern Office Chair'),
('feedback-sample-2', 'negative', 'The color was not as expected from the AR preview', 'napo', 'model-456', 'Standing Desk'),
('feedback-sample-3', 'positive', 'Perfect fit for my living room, exactly as shown in AR', 'napo', 'model-789', 'Minimalist Sofa');
    `,
    instructions: [
      '1. Go to your Supabase dashboard',
      '2. Navigate to SQL Editor',
      '3. Copy and paste the SQL above',
      '4. Click "Run" to create the feedback table',
      '5. The sample data is optional for testing the feature'
    ],
    endpoints_to_test: [
      'GET /api/create-feedback-table - This endpoint (shows SQL)',
      'POST /api/feedback - Submit new feedback',
      'GET /api/feedback - Get all feedback (admin)',
      'GET /api/feedback?customer=napo - Get customer-specific feedback'
    ]
  });
}