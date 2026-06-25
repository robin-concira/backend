require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'backend_db'
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL
    )
  `);

  const { rowCount } = await pool.query('SELECT 1 FROM users');
  if (rowCount === 0) {
    await pool.query(
      "INSERT INTO users (name, email) VALUES ('Alice Johnson', 'alice@example.com'), ('Bob Smith', 'bob@example.com'), ('Charlie Brown', 'charlie@example.com')"
    );
  }
}

app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/users', async (req, res) => {
  const result = await pool.query('SELECT * FROM users ORDER BY id ASC');
  res.json(result.rows);
});

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(result.rows[0]);
});

app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email already exists' });
    }
    throw error;
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  if (existing.rowCount === 0) {
    return res.status(404).json({ message: 'User not found' });
  }

  const updatedName = name || existing.rows[0].name;
  const updatedEmail = email || existing.rows[0].email;

  const result = await pool.query(
    'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *',
    [updatedName, updatedEmail, id]
  );

  res.json(result.rows[0]);
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({ message: 'User deleted' });
});

async function startServer() {
  await initDb();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
