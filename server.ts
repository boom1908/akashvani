import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import { isAllowedBroadcastHost, rewriteHlsPlaylist } from './src/utils/radioLogic.ts';
import type { StationCatalog } from './src/types/radio.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AKASHVANI_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  Referer: 'https://akashvani.gov.in/',
  Origin: 'https://akashvani.gov.in',
  Accept: '*/*',
};

interface CachedHealth {
  checkedAt: number;
  statuses: Record<string, 'live' | 'off-air'>;
}

let healthCache: CachedHealth | null = null;
const HEALTH_TTL_MS = 90_000;

function readStationsCatalog(): StationCatalog {
  const filePath = path.resolve(__dirname, 'stations.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as StationCatalog;
}

async function probeUrl(url: string, timeoutMs = 3500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: AKASHVANI_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes('#EXTM3U');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function addDirectoryToZip(zip: JSZip, fsDir: string, zipBasePath: string): void {
  if (!fs.existsSync(fsDir)) return;
  const entries = fs.readdirSync(fsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'build' || entry.name === '.gradle' || entry.name.endsWith('.jks')) {
      continue;
    }
    const fullPath = path.join(fsDir, entry.name);
    const zipPath = zipBasePath ? `${zipBasePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, zipPath);
    } else {
      zip.file(zipPath, fs.readFileSync(fullPath));
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.get('/api/stations', (_req, res) => {
    try {
      const catalog = readStationsCatalog();
      res.setHeader('Cache-Control', 'no-cache');
      res.json(catalog);
    } catch (err) {
      res.status(500).json({ error: 'Unable to load station catalog' });
    }
  });

  app.get('/api/station-status', async (req, res) => {
    const force = req.query.refresh === '1';
    if (!force && healthCache && Date.now() - healthCache.checkedAt < HEALTH_TTL_MS) {
      res.json(healthCache);
      return;
    }

    try {
      const catalog = readStationsCatalog();
      const entries = await Promise.all(
        catalog.stations.map(async (station) => {
          const urls = [station.streamUrl, ...station.fallbackUrls];
          for (const url of urls) {
            if (await probeUrl(url)) {
              return [station.id, 'live'] as const;
            }
          }
          return [station.id, 'off-air'] as const;
        })
      );

      const statuses: Record<string, 'live' | 'off-air'> = {};
      for (const [id, status] of entries) {
        statuses[id] = status;
      }

      healthCache = { checkedAt: Date.now(), statuses };
      res.json(healthCache);
    } catch {
      res.status(500).json({ error: 'Failed to check station status' });
    }
  });

  app.get('/api/stream-proxy', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!rawUrl || !isAllowedBroadcastHost(rawUrl)) {
      res.status(400).json({ error: 'Invalid or unsupported broadcast host' });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    try {
      const upstream = await fetch(rawUrl, {
        headers: AKASHVANI_HEADERS,
        signal: controller.signal,
        redirect: 'follow',
      });

      if (!upstream.ok) {
        res.status(upstream.status).send(`Upstream broadcast returned ${upstream.status}`);
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      const isPlaylist =
        rawUrl.toLowerCase().includes('.m3u8') ||
        contentType.toLowerCase().includes('mpegurl');

      if (isPlaylist) {
        const manifestText = await upstream.text();
        const rewritten = rewriteHlsPlaylist(manifestText, upstream.url || rawUrl, '/api/stream-proxy');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(rewritten);
        return;
      }

      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType || 'audio/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=15');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(200).send(buffer);
    } catch (err) {
      res.status(502).send('Unable to reach Akashvani broadcast server');
    } finally {
      clearTimeout(timer);
    }
  });

  app.get('/api/workflow-preview', (_req, res) => {
    try {
      const wfPath = path.resolve(__dirname, '.github/workflows/build-android-apk.yml');
      const content = fs.readFileSync(wfPath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(content);
    } catch {
      res.status(404).send('Workflow file not found');
    }
  });

  app.get('/api/download-android-bundle', async (_req, res) => {
    try {
      const zip = new JSZip();
      addDirectoryToZip(zip, path.resolve(__dirname, 'android'), 'android');

      const workflowPath = path.resolve(__dirname, '.github/workflows/build-android-apk.yml');
      if (fs.existsSync(workflowPath)) {
        zip.file('.github/workflows/build-android-apk.yml', fs.readFileSync(workflowPath));
      }

      const stationsPath = path.resolve(__dirname, 'stations.json');
      if (fs.existsSync(stationsPath)) {
        zip.file('stations.json', fs.readFileSync(stationsPath));
      }

      zip.file(
        'README.md',
        [
          '# Akashvani — Native Android App (Malayalam Live Radio)',
          '',
          'This repository builds a signed Android APK automatically in the cloud using GitHub Actions,',
          'zips it, and uploads it directly to **GitHub Releases** — no PC or Android Studio required.',
          '',
          '## How to get your APK using only your phone',
          '1. Push this project to a GitHub repository (or upload these files to a new repo on GitHub).',
          '2. Open your repository on GitHub and tap the **Actions** tab.',
          '3. Select **Build Akashvani Android APK & Publish Release** and tap **Run workflow** (it also runs automatically on push).',
          '4. Wait ~3 minutes, then open the **Releases** page of your repository and download `Akashvani-v1.0.X-android-apk.zip`.',
          '5. Unzip it in your phone Files app and tap the `.apk` to install!',
        ].join('\n')
      );

      const archive = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="akashvani-android-github-kit.zip"'
      );
      res.send(archive);
    } catch {
      res.status(500).json({ error: 'Failed to generate Android project archive' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Akashvani server listening on http://localhost:${PORT}`);
  });
}

startServer();
