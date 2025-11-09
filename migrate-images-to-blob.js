// Migration script to convert existing file-based images to blob storage
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function migrateImagesToBlob() {
  console.log('Starting image migration to blob storage...');
  
  try {
    // Get all products with file-based image URLs
    const [products] = await pool.query(
      'SELECT id, image_url FROM products WHERE image_url IS NOT NULL AND image_url LIKE "/uploads/%"'
    );
    
    console.log(`Found ${products.length} products with file-based images`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const product of products) {
      try {
        // Extract filename from URL
        const filename = product.image_url.replace('/uploads/', '');
        const filePath = path.join(__dirname, 'uploads', filename);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.log(`⚠️  File not found for product ${product.id}: ${filePath}`);
          errorCount++;
          continue;
        }
        
        // Read the file
        const imageBuffer = fs.readFileSync(filePath);
        
        // Determine MIME type from file extension
        const ext = path.extname(filename).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.webp') mimeType = 'image/webp';
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        
        // Update database with blob data
        await pool.query(
          'UPDATE products SET image_blob = ?, image_mime_type = ?, image_url = ? WHERE id = ?',
          [imageBuffer, mimeType, `/api/products/image/${product.id}`, product.id]
        );
        
        console.log(`✓ Migrated product ${product.id}: ${filename}`);
        successCount++;
        
      } catch (err) {
        console.error(`✗ Error migrating product ${product.id}:`, err.message);
        errorCount++;
      }
    }
    
    console.log('\n=== Migration Complete ===');
    console.log(`✓ Successfully migrated: ${successCount}`);
    console.log(`✗ Errors: ${errorCount}`);
    console.log(`Total: ${products.length}`);
    
    if (successCount > 0) {
      console.log('\n⚠️  Note: Old image files in the uploads folder have NOT been deleted.');
      console.log('You can manually delete them after verifying the migration was successful.');
    }
    
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateImagesToBlob();
