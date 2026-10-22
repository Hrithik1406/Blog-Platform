const authForm = document.getElementById('authForm');
const authMessage = document.getElementById('authMessage');
const postForm = document.getElementById('postForm');
const postsContainer = document.getElementById('postsContainer');
const tabs = document.querySelectorAll('.tab');
const logoutBtn = document.getElementById('logoutBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const postTitleInput = document.getElementById('postTitle');
const postContentInput = document.getElementById('postContent');

let authMode = 'login';

const setMessage = (message, isError = false) => {
  authMessage.textContent = message;
  authMessage.style.color = isError ? '#d14d4d' : '#2c8f67';
};

const setLoggedInState = (user) => {
  const isLoggedIn = Boolean(user);
  authForm.classList.toggle('hidden', isLoggedIn);
  postForm.classList.toggle('hidden', !isLoggedIn);
  logoutBtn.classList.toggle('hidden', !isLoggedIn);
  if (isLoggedIn) {
    usernameInput.value = '';
    passwordInput.value = '';
    authForm.reset();
  }
};

const fetchPosts = async () => {
  try {
    const response = await fetch('/api/posts');
    const data = await response.json();
    if (!data.posts) {
      postsContainer.innerHTML = '<div class="empty">No posts yet.</div>';
      return;
    }

    postsContainer.innerHTML = data.posts
      .map(
        (post) => `
          <article class="post-card">
            <h3>${post.title}</h3>
            <div class="post-meta">By ${post.author} • ${new Date(post.created_at).toLocaleString()}</div>
            <p>${post.content}</p>
            <div class="comments">
              ${
                post.comments && post.comments.length
                  ? post.comments
                      .map(
                        (comment) => `
                          <div class="comment">
                            <div class="comment-meta"><strong>${comment.author}</strong> • ${new Date(comment.created_at).toLocaleString()}</div>
                            <div>${comment.content}</div>
                          </div>
                        `
                      )
                      .join('')
                  : '<div class="empty">No comments yet.</div>'
              }
            </div>
            <form class="comment-form" data-post-id="${post.id}">
              <input name="content" type="text" placeholder="Add a comment" required />
              <button class="secondary" type="submit">Post</button>
            </form>
          </article>
        `
      )
      .join('');
  } catch (error) {
    postsContainer.innerHTML = '<div class="empty">Unable to load posts.</div>';
  }
};

const getCurrentUser = async () => {
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) {
      setLoggedInState(null);
      return;
    }
    const data = await response.json();
    setLoggedInState(data.user);
  } catch (error) {
    setLoggedInState(null);
  }
};

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((item) => item.classList.toggle('active', item === tab));
    authMode = tab.dataset.mode;
  });
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    username: usernameInput.value,
    password: passwordInput.value,
  };

  const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'Request failed', true);
      return;
    }

    setMessage(data.message || 'Success');
    await getCurrentUser();
    await fetchPosts();
  } catch (error) {
    setMessage('Something went wrong.', true);
  }
});

postForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    title: postTitleInput.value,
    content: postContentInput.value,
  };

  try {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'Unable to create post', true);
      return;
    }

    postForm.reset();
    setMessage('Post created successfully');
    await fetchPosts();
  } catch (error) {
    setMessage('Unable to create post.', true);
  }
});

postsContainer.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!form.matches('.comment-form')) return;

  event.preventDefault();

  const postId = form.dataset.postId;
  const input = form.querySelector('input[name="content"]');
  const content = input.value.trim();

  if (!content) return;

  try {
    const response = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const data = await response.json();
      setMessage(data.message || 'Unable to add comment', true);
      return;
    }

    input.value = '';
    await fetchPosts();
  } catch (error) {
    setMessage('Unable to add comment.', true);
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  setLoggedInState(null);
  await fetchPosts();
  setMessage('Logged out');
});

getCurrentUser();
fetchPosts();
