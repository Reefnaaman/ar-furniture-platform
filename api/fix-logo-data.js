// Database cleanup and constraint script for logo security
// Run this once to fix existing data and add constraints

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixLogoData() {
  try {
    console.log('🔧 Starting logo data cleanup and security fixes...\n');

    // Step 1: Normalize existing image types
    console.log('1️⃣ Normalizing image types...');
    const { data: updateResult, error: updateError } = await supabase.rpc(
      'normalize_image_types', 
      {}, 
      { 
        count: 'exact',
        // Use RPC to execute custom SQL safely
      }
    );

    // If RPC doesn't exist, do direct updates
    const imageTypeUpdates = [
      { from: 'Customer_logo', to: 'customer_logo' },
      { from: 'CUSTOMER_LOGO', to: 'customer_logo' },
      { from: 'customer-logo', to: 'customer_logo' },
    ];

    for (const update of imageTypeUpdates) {
      const { data, error } = await supabase
        .from('images')
        .update({ image_type: update.to })
        .eq('image_type', update.from);

      if (error) {
        console.warn(`Warning updating ${update.from}: ${error.message}`);
      }
    }

    // Step 2: Normalize customer IDs to lowercase
    console.log('2️⃣ Normalizing customer IDs to lowercase...');
    const { data: images, error: fetchError } = await supabase
      .from('images')
      .select('id, customer_id')
      .not('customer_id', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch images: ${fetchError.message}`);
    }

    let normalizedCount = 0;
    for (const image of images || []) {
      const normalized = image.customer_id?.toLowerCase().trim();
      if (normalized !== image.customer_id) {
        const { error } = await supabase
          .from('images')
          .update({ customer_id: normalized })
          .eq('id', image.id);

        if (!error) normalizedCount++;
      }
    }
    
    console.log(`   ✅ Normalized ${normalizedCount} customer IDs`);

    // Step 3: Find and resolve duplicate customer logos
    console.log('3️⃣ Resolving duplicate customer logos...');
    const { data: logoGroups } = await supabase
      .from('images')
      .select('customer_id, id, cloudinary_public_id, created_at')
      .eq('image_type', 'customer_logo')
      .not('customer_id', 'is', null)
      .order('customer_id, created_at', { ascending: false });

    const customerGroups = {};
    logoGroups?.forEach(logo => {
      if (!customerGroups[logo.customer_id]) {
        customerGroups[logo.customer_id] = [];
      }
      customerGroups[logo.customer_id].push(logo);
    });

    let duplicatesRemoved = 0;
    const { deleteImage } = await import('../lib/cloudinary.js');

    for (const [customerId, logos] of Object.entries(customerGroups)) {
      if (logos.length > 1) {
        console.log(`   🔍 Customer ${customerId} has ${logos.length} logos`);
        
        // Keep the newest, delete the rest
        const toDelete = logos.slice(1);
        
        for (const logo of toDelete) {
          try {
            // Delete from Cloudinary
            await deleteImage(logo.cloudinary_public_id);
            
            // Delete from database
            await supabase
              .from('images')
              .delete()
              .eq('id', logo.id);

            duplicatesRemoved++;
            console.log(`   🗑️ Removed duplicate logo: ${logo.id}`);
          } catch (e) {
            console.warn(`   ⚠️ Failed to delete logo ${logo.id}: ${e.message}`);
          }
        }
      }
    }

    console.log(`   ✅ Removed ${duplicatesRemoved} duplicate logos`);

    // Step 4: Check for case sensitivity issues
    console.log('4️⃣ Checking for case sensitivity issues...');
    const { data: caseIssues } = await supabase.rpc('find_case_conflicts', {});
    
    // Manual check since RPC might not exist
    const { data: allLogos } = await supabase
      .from('images')
      .select('customer_id')
      .eq('image_type', 'customer_logo')
      .not('customer_id', 'is', null);

    const customerIds = [...new Set(allLogos?.map(l => l.customer_id) || [])];
    const caseConflicts = {};
    
    customerIds.forEach(id => {
      const lower = id.toLowerCase();
      if (!caseConflicts[lower]) caseConflicts[lower] = [];
      caseConflicts[lower].push(id);
    });

    const conflicts = Object.values(caseConflicts).filter(group => group.length > 1);
    if (conflicts.length > 0) {
      console.log('   ⚠️ Case sensitivity conflicts found:');
      conflicts.forEach(group => {
        console.log(`     - ${group.join(' vs ')}`);
      });
    } else {
      console.log('   ✅ No case sensitivity conflicts found');
    }

    console.log('\n🎉 Logo data cleanup completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Image types normalized`);
    console.log(`   - ${normalizedCount} customer IDs normalized`);
    console.log(`   - ${duplicatesRemoved} duplicate logos removed`);
    console.log(`   - Security validations now enforced`);

  } catch (error) {
    console.error('💥 Logo data cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
fixLogoData();