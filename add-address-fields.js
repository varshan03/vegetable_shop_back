const pool = require('./db');

async function addAddressFields() {
  const conn = await pool.getConnection();
  try {
    console.log('Adding address fields to orders table...');

    // Check if columns exist before adding
    const [columns] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='orders' AND COLUMN_NAME IN ('house_no', 'street', 'landmark', 'area', 'city', 'pincode')"
    );

    if (columns.length < 6) {
      // Add each column if it doesn't exist
      const fieldsToAdd = [
        { name: 'house_no', type: 'VARCHAR(255)', exists: columns.some(c => c.COLUMN_NAME === 'house_no') },
        { name: 'street', type: 'VARCHAR(255)', exists: columns.some(c => c.COLUMN_NAME === 'street') },
        { name: 'landmark', type: 'VARCHAR(255)', exists: columns.some(c => c.COLUMN_NAME === 'landmark') },
        { name: 'area', type: 'VARCHAR(255)', exists: columns.some(c => c.COLUMN_NAME === 'area') },
        { name: 'city', type: 'VARCHAR(100)', exists: columns.some(c => c.COLUMN_NAME === 'city') },
        { name: 'pincode', type: 'VARCHAR(10)', exists: columns.some(c => c.COLUMN_NAME === 'pincode') }
      ];

      for (const field of fieldsToAdd) {
        if (!field.exists) {
          try {
            await conn.query(`ALTER TABLE orders ADD COLUMN ${field.name} ${field.type} DEFAULT NULL`);
            console.log(`✓ Added column: ${field.name}`);
          } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
              console.log(`✓ Column ${field.name} already exists`);
            } else {
              throw err;
            }
          }
        }
      }

      console.log('\n✓ Migration completed successfully!');
      console.log('New columns added to orders table:');
      console.log('  - house_no (VARCHAR 255)');
      console.log('  - street (VARCHAR 255)');
      console.log('  - landmark (VARCHAR 255)');
      console.log('  - area (VARCHAR 255)');
      console.log('  - city (VARCHAR 100)');
      console.log('  - pincode (VARCHAR 10)');
    } else {
      console.log('✓ All address columns already exist!');
    }

  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
}

addAddressFields();
