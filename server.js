const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initial DB template
const DEFAULT_DB = {
  memories: [],
  journals: [],
  letters: [],
  chats: [
    { sender: 'maruko', text: 'Halo Nadin manis! Maruko siap menemani harimu 🌸', time: '08:30' },
    { sender: 'user', text: 'Pagi Maruko! Hari ini banyak kerjaan nih...', time: '08:32' },
    { sender: 'maruko', text: 'Semangat yaa Nadin! Jangan lupa minum air putih dan jangan skip makan siang 🥰', time: '08:33' }
  ]
};

function readDb() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
  return DEFAULT_DB;
}

function writeDb(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing DB:', e);
    return false;
  }
}

// Initialize db file if not exists
readDb();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.aac': 'audio/aac'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const [reqPath] = req.url.split('?');

  // API 1: Get Sync Data
  if (req.method === 'GET' && reqPath === '/api/data') {
    const data = readDb();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify(data));
    return;
  }

function mergeById(existingList, incomingList) {
  const map = new Map();
  // Add incoming items first (so new items are at the front)
  for (const item of (incomingList || [])) {
    if (item && item.id) map.set(item.id, item);
  }
  // Preserve any existing items from database that incoming didn't have
  for (const item of (existingList || [])) {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

  // API 2: Post Sync Data
  if (req.method === 'POST' && reqPath === '/api/sync') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const current = readDb();
        const updated = {
          memories: Array.isArray(payload.memories) ? payload.memories : current.memories,
          journals: Array.isArray(payload.journals) ? payload.journals : current.journals,
          letters: Array.isArray(payload.letters) ? payload.letters : current.letters,
          chats: Array.isArray(payload.chats) ? payload.chats : current.chats,
          updatedAt: Number(payload.updatedAt) || Date.now()
        };
        writeDb(updated);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: updated.memories.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API 3: Upload Image (Base64)
  if (req.method === 'POST' && reqPath === '/api/upload') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { image, name } = JSON.parse(body);
        if (!image || !image.startsWith('data:image')) {
          throw new Error('Invalid image format');
        }
        const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (!matches) throw new Error('Could not parse data url');

        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const filename = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);

        const buffer = Buffer.from(matches[2], 'base64');
        fs.writeFileSync(filePath, buffer);

        console.log(`📸 Foto baru tersimpan dari HP: uploads/${filename} (${buffer.length} bytes)`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, url: `/uploads/${filename}` }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  let targetPath = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.join(__dirname, decodeURIComponent(targetPath));

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Prevent caching for HTML, JS, JSON, and Service Worker so updates apply immediately
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌸 Nadin PWA Server + Real-time Sync Berjalan!`);
  console.log(`> Local:   http://localhost:${PORT}`);
  
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`> Network: http://${iface.address}:${PORT} (bisa dibuka di HP/iPhone)`);
      }
    }
  }
  console.log(`\nTekan Ctrl+C untuk berhenti.\n`);
});
