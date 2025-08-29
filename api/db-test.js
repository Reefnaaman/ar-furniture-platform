/**
 * Test database connection
 * GET /api/db-test
 */
export default async function handler(req, res) {
  try {
    // Test importing postgres
    console.log('Importing @vercel/postgres...');
    const { sql } = await import('@vercel/postgres');
    
    console.log('Testing database connection...');
    // Simple query to test connection
    const result = await sql`SELECT NOW() as current_time, version() as pg_version;`;
    
    console.log('Database query successful!');
    
    res.status(200).json({
      success: true,
      message: 'Database connection working!',
      data: result.rows[0],
      env_check: {
        postgres_url: !!process.env.POSTGRES_URL,
        postgres_prisma_url: !!process.env.POSTGRES_PRISMA_URL,
        postgres_host: !!process.env.POSTGRES_HOST
      }
    });
    
  } catch (error) {
    console.error('Database test error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      env_vars_present: {
        postgres_url: !!process.env.POSTGRES_URL,
        postgres_prisma_url: !!process.env.POSTGRES_PRISMA_URL,
        postgres_host: !!process.env.POSTGRES_HOST,
        postgres_user: !!process.env.POSTGRES_USER,
        postgres_password: !!process.env.POSTGRES_PASSWORD,
        postgres_database: !!process.env.POSTGRES_DATABASE
      }
    });
  }
}