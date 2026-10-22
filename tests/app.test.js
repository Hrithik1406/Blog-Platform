const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const request = require('supertest');
const { app, closeDb, initDb } = require('../src/app');

const db = new sqlite3.Database(path.join(__dirname, '../data/blog.db'));

describe('Blog Platform API', () => {
  beforeEach(async () => {
    await initDb();
    await new Promise((resolve, reject) => {
      db.exec('DELETE FROM comments; DELETE FROM posts; DELETE FROM users;', (err) => (err ? reject(err) : resolve()));
    });
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      db.close((err) => (err ? reject(err) : resolve()));
    });
    await closeDb();
  });

  it('registers a user and returns a token/session', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'secret123' })
      .expect(201);

    expect(res.body).toHaveProperty('message');
    expect(res.body.user).toHaveProperty('username', 'alice');
  });

  it('creates a post for the authenticated user', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'secret123' })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'secret123' })
      .expect(200);

    const cookie = loginRes.headers['set-cookie'][0].split(';')[0];

    const postRes = await request(app)
      .post('/api/posts')
      .set('Cookie', cookie)
      .send({ title: 'My first post', content: 'Hello world' })
      .expect(201);

    expect(postRes.body.post).toHaveProperty('title', 'My first post');
    expect(postRes.body.post).toHaveProperty('content', 'Hello world');
  });

  it('allows comments on a post', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'secret123' })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'secret123' })
      .expect(200);

    const cookie = loginRes.headers['set-cookie'][0].split(';')[0];

    await request(app)
      .post('/api/posts')
      .set('Cookie', cookie)
      .send({ title: 'A post to comment on', content: 'This is the post content.' })
      .expect(201);

    const postsRes = await request(app)
      .get('/api/posts')
      .set('Cookie', cookie)
      .expect(200);

    const postId = postsRes.body.posts[0].id;

    const commentRes = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', cookie)
      .send({ content: 'Nice article!' })
      .expect(201);

    expect(commentRes.body.comment).toHaveProperty('content', 'Nice article!');
  });
});
