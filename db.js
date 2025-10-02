const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  user: '3NkjgjmEzr6n9MQ.root',
  password: 'RkGjuVHH3cNZFkYs',
  database: 'veg_shop',
  port: 4000,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: {
    rejectUnauthorized: true
  }
});

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Database connection successful!");
    connection.release();
  }
});

module.exports = pool;
