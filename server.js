const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'posts.json');

// 确保 data 目录存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// 初始化数据文件
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// 读取文章数据
function readPosts() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

// 写入文章数据
function writePosts(posts) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2), 'utf-8');
}

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== API 路由 ==========

// 获取文章列表（支持分页）
app.get('/api/posts', (req, res) => {
  const posts = readPosts();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 15));
  const keyword = (req.query.keyword || '').trim();

  let filtered = posts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  if (keyword) {
    const lower = keyword.toLowerCase();
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(lower) ||
      p.content.toLowerCase().includes(lower)
    );
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const start = (page - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize).map(p => ({
    id: p.id,
    title: p.title,
    author: p.author,
    views: p.views,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    summary: p.content.replace(/<[^>]*>/g, '').substring(0, 120)
  }));

  res.json({ code: 0, data: { list, total, page, pageSize, totalPages } });
});

// 获取单篇文章
app.get('/api/posts/:id', (req, res) => {
  const posts = readPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ code: 1, msg: '文章不存在' });
  }
  // 增加浏览量
  post.views = (post.views || 0) + 1;
  writePosts(posts);
  res.json({ code: 0, data: post });
});

// 发布文章
app.post('/api/posts', (req, res) => {
  const { title, content, author } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ code: 1, msg: '标题不能为空' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ code: 1, msg: '内容不能为空' });
  }

  const posts = readPosts();
  const now = new Date().toISOString();
  const post = {
    id: crypto.randomUUID(),
    title: title.trim().substring(0, 200),
    content: content.trim(),
    author: (author || '匿名').trim().substring(0, 50),
    views: 0,
    createdAt: now,
    updatedAt: now
  };
  posts.push(post);
  writePosts(posts);
  res.json({ code: 0, data: post, msg: '发布成功' });
});

// 修改文章
app.put('/api/posts/:id', (req, res) => {
  const { title, content, author } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ code: 1, msg: '标题不能为空' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ code: 1, msg: '内容不能为空' });
  }

  const posts = readPosts();
  const idx = posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ code: 1, msg: '文章不存在' });
  }

  posts[idx].title = title.trim().substring(0, 200);
  posts[idx].content = content.trim();
  posts[idx].author = (author || posts[idx].author).trim().substring(0, 50);
  posts[idx].updatedAt = new Date().toISOString();
  writePosts(posts);
  res.json({ code: 0, data: posts[idx], msg: '修改成功' });
});

// 删除文章
app.delete('/api/posts/:id', (req, res) => {
  const posts = readPosts();
  const idx = posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ code: 1, msg: '文章不存在' });
  }
  posts.splice(idx, 1);
  writePosts(posts);
  res.json({ code: 0, msg: '删除成功' });
});

// 所有非API请求返回首页（SPA）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`博客系统已启动: http://localhost:${PORT}`);
});
