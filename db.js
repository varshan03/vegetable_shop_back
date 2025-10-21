const fs = require('fs');
const mysql = require('mysql2/promise');



// const pool = mysql.createPool({
//   host: 'localhost',
//   user: 'root',
//   password: 'root',
//   database: 'veg_shop',
//   // port: 3306,
//   waitForConnections: true,
//   connectionLimit: 10,
//   // ssl: { rejectUnauthorized: true }
// });

const pool = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  user: '3NkjgjmEzr6n9MQ.root',
  password: 'RkGjuVHH3cNZFkYs',
  database: 'veg_shop',
  port: 4000,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: { rejectUnauthorized: true }
});

module.exports = pool;
