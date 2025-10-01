// db.js - mysql2/promise connection helper
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'veg_shop',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
