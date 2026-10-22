const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database(path.join(__dirname, '../data/blog.db'));

app.use(express.json());
app.use(async (req, res, next) => {
  try {
    await initDb();
    next();
  } catch (error) {
    res.status(500).json({ message: 'Database initialization failed', error: error.message });
  }
});
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(
  session({
    secret: 'blog-platform-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    },
  })
);

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const getOne = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password || String(username).trim().length < 3 || String(password).trim().length < 6) {
    return res.status(400).json({ message: 'Username must be at least 3 characters and password at least 6 characters.' });
  }

  const normalizedUsername = String(username).trim();

  try {
    const existingUser = await getOne('SELECT id FROM users WHERE username = ?', [normalizedUsername]);
    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const result = await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [normalizedUsername, passwordHash]);

    req.session.userId = result.id;
    const user = await getOne('SELECT id, username FROM users WHERE id = ?', [result.id]);

    return res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register user', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};

  try {
    const user = await getOne('SELECT * FROM users WHERE username = ?', [String(username || '').trim()]);
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(String(password || ''), user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    req.session.userId = user.id;
    return res.json({
      message: 'Login successful',
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to log in', error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  getOne('SELECT id, username FROM users WHERE id = ?', [req.session.userId])
    .then((user) => res.json({ user }))
    .catch((error) => res.status(500).json({ message: error.message }));
});

app.get('/api/posts', async (req, res) => {
  try {
    const posts = await query(`
      SELECT p.*, u.username as author
      FROM posts p
      JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
    `);

    const postsWithComments = await Promise.all(
      posts.map(async (post) => {
        const comments = await query(`
          SELECT c.*, u.username as author
          FROM comments c
          JOIN users u ON u.id = c.user_id
          WHERE c.post_id = ?
          ORDER BY c.created_at ASC
        `, [post.id]);

        return { ...post, comments };
      })
    );

    res.json({ posts: postsWithComments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/posts', requireAuth, async (req, res) => {
  const { title, content } = req.body || {};

  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content are required.' });
  }

  try {
    const result = await run('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)', [req.session.userId, String(title).trim(), String(content).trim()]);
    const post = await getOne(`
      SELECT p.*, u.username as author
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = ?
    `, [result.id]);

    res.status(201).json({ message: 'Post created successfully', post: { ...post, comments: [] } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create post', error: error.message });
  }
});

app.post('/api/posts/:id/comments', requireAuth, async (req, res) => {
  const postId = Number(req.params.id);
  const { content } = req.body || {};

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ message: 'Invalid post id' });
  }

  if (!content || String(content).trim().length === 0) {
    return res.status(400).json({ message: 'Comment content is required.' });
  }

  try {
    const post = await getOne('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const result = await run('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [postId, req.session.userId, String(content).trim()]);
    const comment = await getOne(`
      SELECT c.*, u.username as author
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `, [result.id]);

    res.status(201).json({ message: 'Comment added successfully', comment });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add comment', error: error.message });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = { app, initDb, closeDb: () => new Promise((resolve, reject) => db.close((err) => (err ? reject(err) : resolve()))) };
