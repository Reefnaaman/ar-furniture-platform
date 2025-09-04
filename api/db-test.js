import { supabase } from '../lib/supabase.js';

async function checkCustomerLogos() {
  try {
    console.log('🔍 Checking for customer logos in the database...\n');
    
    // Query all images with type 'customer_logo' or 'Customer_logo'
    const { data: logos, error } = await supabase
      .from('images')
      .select('*')
      .or('image_type.eq.customer_logo,image_type.eq.Customer_logo')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error querying logos:', error);
      return;
    }
    
    if (!logos || logos.length === 0) {
      console.log('📝 No customer logos found in the database.');
      console.log('\n💡 To add a customer logo:');
      console.log('1. Upload an image through the admin panel');
      console.log('2. Set image_type to "customer_logo"');
      console.log('3. Set customer_id to the customer ID (e.g., "napo")');
      return;
    }
    
    console.log(`✅ Found ${logos.length} customer logo(s):\n`);
    
    logos.forEach((logo, index) => {
      console.log(`Logo ${index + 1}:`);
      console.log(`  - ID: ${logo.id}`);
      console.log(`  - Customer ID: ${logo.customer_id || 'Not set'}`);
      console.log(`  - Filename: ${logo.filename}`);
      console.log(`  - Image Type: ${logo.image_type}`);
      console.log(`  - URL: ${logo.cloudinary_url}`);
      console.log(`  - Size: ${logo.width}x${logo.height}`);
      console.log(`  - Created: ${new Date(logo.created_at).toLocaleString()}`);
      console.log('');
    });
    
    // Also check which customers have assigned models
    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('customer_id, customer_name')
      .not('customer_id', 'eq', 'unassigned');
    
    if (!modelsError && models) {
      const uniqueCustomers = [...new Set(models.map(m => m.customer_id))];
      console.log('\n📊 Customers with assigned models:');
      uniqueCustomers.forEach(customerId => {
        const hasLogo = logos.some(l => l.customer_id === customerId);
        console.log(`  - ${customerId}: ${hasLogo ? '✅ Has logo' : '❌ No logo'}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkCustomerLogos();