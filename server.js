// server.js - basic Express server (no JWT auth)
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const time = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${time}-${file.fieldname}${ext}`);
  }
});
const upload = multer({ storage });

// ---------- Users / Login (simple) ----------
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(req.body);
  
  try {
    const [rows] = await pool.query('SELECT id,name,email,role FROM users WHERE email=? AND password=?', [email, password]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(rows[0]); // return user object (no token)
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create user (signup) - simple
app.post('/api/users', async (req, res) => {
  const { name, email, password, role='customer' } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)', [name,email,password,role]);
    const id = result.insertId;
    const [rows] = await pool.query('SELECT id,name,email,role FROM users WHERE id=?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create user' });
  }
});

// ---------- Products ----------
app.get('/api/products', async (req,res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json(rows);
  } catch(err){ res.status(500).json({ error: 'Server error' }); }
});
app.get('/api/delivery/person', async (req,res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE role="delivery"');
    res.json(rows);
  } catch(err){ res.status(500).json({ error: 'Server error' }); }
});

// Create product (admin)
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    console.log(req.body, req.file);

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const [result] = await pool.query(
      'INSERT INTO products (name, price, stock, image_url) VALUES (?, ?, ?, ?)',
      [name, price, stock, image_url]
    );

    const [rows] = await pool.query('SELECT * FROM products WHERE id=?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create product" });
  }
});
  
// Update product
app.put('/api/products/:id', upload.single('image'), async (req,res) => {
  try {
    const id = req.params.id;
    const { name, price, stock } = req.body;
    let image_url;
    if (req.file) image_url = '/uploads/' + req.file.filename;
    // build query dynamically
    const updates = [];
    const params = [];
    if (name) { updates.push('name=?'); params.push(name); }
    if (price) { updates.push('price=?'); params.push(price); }
    if (stock !== undefined) { updates.push('stock=?'); params.push(stock); }
    if (image_url) { updates.push('image_url=?'); params.push(image_url); }
    params.push(id);
    const sql = `UPDATE products SET ${updates.join(', ')} WHERE id=?`;
    await pool.query(sql, params);
    const [rows] = await pool.query('SELECT * FROM products WHERE id=?', [id]);
    res.json(rows[0]);
  } catch(err){ console.error(err); res.status(500).json({ error: 'Could not update product' }); }
});

// Delete product
app.delete('/api/products/:id', async (req,res) => {
  try {
    const id = req.params.id;
    await pool.query('DELETE FROM products WHERE id=?', [id]);
    res.json({ success: true });
  } catch(err){ res.status(500).json({ error: 'Could not delete' }); }
});

// ---------- Orders & checkout ----------
app.post('/api/orders', async (req,res) => {
  // Put stock update + order creation inside a transaction
  const conn = await pool.getConnection();
  try {
    const { user_id, items, latitude, longitude, address } = req.body; // items: [{product_id, quantity, price}]
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });

    await conn.beginTransaction();

    // compute total and verify stock
    let total = 0;
    for (const it of items) {
      total += Number(it.price) * Number(it.quantity);
      const [p] = await conn.query('SELECT stock FROM products WHERE id=? FOR UPDATE', [it.product_id]);
      if (p.length === 0) throw new Error('Product not found');
      if (p[0].stock < it.quantity) throw new Error(`Insufficient stock for product ${it.product_id}`);
    }

    const [orderResult] = await conn.query('INSERT INTO orders (customer_id,total_price,status,latitude,longitude,address) VALUES (?,?,?,?,?,?)', [user_id, total, 'pending', latitude, longitude, address]);
    const orderId = orderResult.insertId;
    // insert items and decrement stock
    for (const it of items) {
      await conn.query('INSERT INTO order_items (order_id,product_id,quantity,price) VALUES (?,?,?,?)', [orderId, it.product_id, it.quantity, it.price]);
      await conn.query('UPDATE products SET stock = stock - ? WHERE id=?', [it.quantity, it.product_id]);
    }

    await conn.commit();
    res.json({ success: true, orderId });
  } catch(err) {
    await conn.rollback();
    console.error(err.message);
    res.status(400).json({ error: err.message || 'Order failed' });
  } finally { conn.release(); }
});

// Get orders (optionally by customer)
app.get('/api/orders', async (req,res) => {
  const { customerId } = req.query;
  try {
    let sql = 'SELECT * FROM orders';
    const params = [];
    if (customerId) { sql += ' WHERE customer_id=?'; params.push(customerId); }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    // attach items
    for (const o of rows) {
      const [items] = await pool.query('SELECT oi.*, p.name, p.image_url FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?', [o.id]);
      o.items = items;
    }
    res.json(rows);
  } catch(err){ console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---------- Delivery tasks ----------
app.post('/api/delivery/assign', async (req,res) => {
  try {
    const { order_id, delivery_person_id } = req.body;
    // set order status assigned
    await pool.query('UPDATE orders SET status=? WHERE id=?', ['assigned', order_id]);
    const [r] = await pool.query('INSERT INTO delivery_tasks (order_id, delivery_person_id, status) VALUES (?,?,?)', [order_id, delivery_person_id, 'assigned']);
    res.json({ success: true, taskId: r.insertId });
  } catch(err){ console.error(err); res.status(500).json({ error: 'Could not assign' }); }
});

// Delivery updates
app.put('/api/delivery/task/:id', async (req,res) => {
  try {
    const id = req.params.id;
    const { status } = req.body; // picked_up, on_the_way, delivered
    await pool.query('UPDATE delivery_tasks SET status=? WHERE id=?', [status, id]);
    // optionally update order status
    const [[taskRows]] = await pool.query('SELECT order_id FROM delivery_tasks WHERE id=?', [id]);
    if (taskRows && status === 'delivered') {
      await pool.query('UPDATE orders SET status=? WHERE id=?', ['delivered', taskRows.order_id]);
    } else if (taskRows && status === 'on_the_way') {
      await pool.query('UPDATE orders SET status=? WHERE id=?', ['on_the_way', taskRows.order_id]);
    }
    res.json({ success: true });
  } catch(err){ console.error(err); res.status(500).json({ error: 'Could not update' }); }
});

// Get tasks for a delivery person
app.get('/api/delivery/tasks/:deliveryId', async (req,res) => {
  const deliveryId = req.params.deliveryId;
  try {
    const [rows] = await pool.query(
      'SELECT dt.*, o.total_price, o.status as order_status, o.customer_id, o.address, o.latitude, o.longitude, u.name as customer_name FROM delivery_tasks dt JOIN orders o ON o.id=dt.order_id LEFT JOIN users u ON u.id=o.customer_id WHERE dt.delivery_person_id=? ORDER BY dt.assigned_at DESC',
      [deliveryId]
    );
    res.json(rows);
  } catch(err){ console.error(err); res.status(500).json({ error: 'Server error' }); }
});


app.get('/api/orders/user/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const [rows] = await pool.query(
      `SELECT 
         o.id AS order_id, o.customer_id, o.status, o.created_at,
         oi.id AS order_item_id, oi.product_id, oi.quantity, oi.price,
         p.name AS product_name, p.image_url AS product_image_url
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       WHERE o.customer_id = ?`,
      [userId]
    );

    // Group items under each order
    const orders = {};
    rows.forEach(row => {
      if (!orders[row.order_id]) {
        orders[row.order_id] = {
          order_id: row.order_id,
          customer_id: row.customer_id,
          status: row.status,
          created_at: row.created_at,
          total_price: 0,
          items: []
        };
      }
      orders[row.order_id].items.push({
        order_item_id: row.order_item_id,
        product_id: row.product_id,
        name: row.product_name,
        image_url: row.product_image_url,
        quantity: row.quantity,
        price: row.price
      });
      orders[row.order_id].total_price += row.price * row.quantity;
    });

    res.json(Object.values(orders));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


app.post('/api/orders/assign', async (req,res) => {
  try {
    const { order_id, delivery_person_id } = req.body;
    await pool.query('UPDATE orders SET status=? WHERE id=?', ['assigned', order_id]);
    const [r] = await pool.query('INSERT INTO delivery_tasks (order_id, delivery_person_id, status) VALUES (?,?,?)', [order_id, delivery_person_id, 'assigned']);
    res.json({ success: true, taskId: r.insertId });
  } catch(err){ console.error(err); res.status(500).json({ error: 'Could not assign' }); }
});


app.post('/api/signup', async (req,res) => {
  try {
    const { name, email, password } = req.body;
    const [r] = await pool.query('INSERT INTO users (name,email,password) VALUES (?,?,?)', [name, email, password]);
    res.json({ success: true, userId: r.insertId });
  } catch(err){ console.error(err); res.status(500).json({ error: 'Could not signup' }); }
});

// Simple server health
app.get('/api/ping', (req,res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('Server running on port', PORT));
