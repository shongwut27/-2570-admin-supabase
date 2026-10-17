import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxAy7aZQPJ0vL6TxkMU0TBhsjdelhbUTiUHLe_u27_3rXy_aG180fYMb8mwFEY-wkW1Ig/exec";

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Proxy route to fetch Google Apps Script data server-side without CORS / redirect issues with retries
  app.get('/api/sheets-data', async (req, res) => {
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(WEB_APP_URL, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) {
          throw new Error(`HTTP status ${response.status}`);
        }
        const data = await response.json();
        return res.json(data);
      } catch (err: any) {
        lastError = err;
        console.warn(`Attempt ${attempt} to fetch sheets data failed: ${err.message}`);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    res.status(502).json({ status: 'error', message: lastError?.message || 'Failed after 3 attempts' });
  });

  // Proxy route to handle warm-up / ping server-side without direct browser fetches to script.google.com
  app.get('/api/ping', async (req, res) => {
    try {
      await fetch(WEB_APP_URL, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      });
      res.json({ status: 'success', origin: 'proxy' });
    } catch (err: any) {
      res.status(502).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/ping', async (req, res) => {
    try {
      await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({ action: 'ping' }),
        signal: AbortSignal.timeout(5000)
      });
      res.json({ status: 'success', origin: 'proxy' });
    } catch (err: any) {
      res.status(502).json({ status: 'error', message: err.message });
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();
