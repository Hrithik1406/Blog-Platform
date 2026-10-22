# Blog Platform with Comments

A full-stack blogging application where users can register, log in, create blog posts, and add comments to posts.

## Features

- User registration and login
- Secure password hashing
- Session-based authentication
- Create, view, and manage blog posts
- Add comments to posts
- SQLite database integration
- Responsive UI

## Tech Stack

- Node.js
- Express.js
- SQLite3
- Express Session
- bcryptjs
- HTML, CSS, JavaScript
- Jest + Supertest for testing

## Project Structure

```bash
blog-platform/
├── public/
│   ├── app.js
│   ├── index.html
│   ├── styles.css
├── src/
│   └── app.js
├── tests/
│   └── app.test.js
├── data/
│   └── blog.db
├── server.js
├── package.json
├── README.md
```

## Prerequisites

Make sure you have the following installed:

- Node.js (v18 or later recommended)
- npm

## Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/blog-platform.git
cd blog-platform
```

2. Install dependencies:

```bash
npm install
```

## Run the Application

Start the server:

```bash
node server.js
```

Then open your browser at:

```bash
http://localhost:3000
```

## Run Tests

```bash
npm test
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Log in a user
- `POST /api/auth/logout` - Log out a user
- `GET /api/auth/me` - Get current authenticated user

### Posts

- `GET /api/posts` - Fetch all posts with comments
- `POST /api/posts` - Create a new post

### Comments

- `POST /api/posts/:id/comments` - Add a comment to a post

## Example Usage

### Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret123"}'
```

### Login User

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret123"}'
```

### Create Post

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Post","content":"Hello world!"}'
```

### Add Comment

```bash
curl -X POST http://localhost:3000/api/posts/1/comments \
  -H "Content-Type: application/json" \
  -d '{"content":"Nice article!"}'
```

## Notes

- This project uses SQLite for local persistence.
- The database file is created automatically when the app starts.
- The app is suitable for learning, local development, and small personal blog use.

## License

This project is open-source and available under the MIT license.
