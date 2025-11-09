// Quick script to check if the database schema is correct
const pool = require('./db');

async function checkSchema() {
  console.log('Checking database schema...\n');
  
  try {
    // Check if products table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'products'");
    
    if (tables.length === 0) {
      console.log('❌ Products table does not exist!');
      return;
    }
    
    console.log('✓ Products table exists');
    
    // Check columns
    const [columns] = await pool.query("DESCRIBE products");
    
    console.log('\nCurrent columns in products table:');
    console.log('─'.repeat(60));
    columns.forEach(col => {
      console.log(`  ${col.Field.padEnd(20)} ${col.Type.padEnd(20)} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('─'.repeat(60));
    
    // Check for required columns
    const columnNames = columns.map(c => c.Field);
    const requiredColumns = ['id', 'name', 'price', 'stock', 'image_url', 'description', 'category', 'uom', 'image_blob', 'image_mime_type'];
    
    console.log('\nRequired columns check:');
    requiredColumns.forEach(col => {
      const exists = columnNames.includes(col);
      console.log(`  ${exists ? '✓' : '❌'} ${col}`);
    });
    
    // Count products
    const [count] = await pool.query('SELECT COUNT(*) as total FROM products');
    console.log(`\n📊 Total products: ${count[0].total}`);
    
    // Check products with images
    const [withImages] = await pool.query('SELECT COUNT(*) as total FROM products WHERE image_url IS NOT NULL');
    console.log(`📷 Products with images: ${withImages[0].total}`);
    
    if (columnNames.includes('image_blob')) {
      const [withBlobs] = await pool.query('SELECT COUNT(*) as total FROM products WHERE image_blob IS NOT NULL');
      console.log(`💾 Products with blob images: ${withBlobs[0].total}`);
    }
    
    console.log('\n✅ Schema check complete!');
    
  } catch (err) {
    console.error('❌ Error checking schema:', err.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
