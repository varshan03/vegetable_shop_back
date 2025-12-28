const pool = require('./db');

async function addPaymentField() {
  const conn = await pool.getConnection();
  try {
    console.log('Adding payment_method field to orders table...');

    // Check if column exists
    const [columns] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='orders' AND COLUMN_NAME='payment_method'"
    );

    if (columns.length === 0) {
      try {
        await conn.query(`ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT 'cod'`);
        console.log('✓ Added column: payment_method');
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log('✓ Column payment_method already exists');
        } else {
          throw err;
        }
      }

      console.log('\n✓ Migration completed successfully!');
      console.log('New column added to orders table:');
      console.log('  - payment_method (VARCHAR 50, default: cod)');
    } else {
      console.log('✓ payment_method column already exists!');
    }

  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
}

addPaymentField();
