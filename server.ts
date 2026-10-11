import express, { Request, Response } from 'express';
import http from 'http';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware for parsing JSON with high body limits for base64 images
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// In-memory cache for downloaded videos to ensure buttery-smooth playback
const videoCache = new Map<string, { buffer: Buffer; mimeType: string }>();

const apiKey = process.env.GEMINI_API_KEY || '';

const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Health / Config endpoint
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    hasApiKey: !!process.env.GEMINI_API_KEY,
    defaultModel: 'veo-3.1-fast-generate-preview',
    supportedModels: [
      { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast (Recommended)', tag: 'Fast' },
      { id: 'veo-3.1-lite-generate-preview', name: 'Veo 3.1 Lite', tag: 'Standard' },
      { id: 'veo-3.1-generate-preview', name: 'Veo 3.1 Cinematic Quality', tag: 'High-Res' },
    ],
  });
});

// Start video generation
app.post('/api/generate-video', async (req: Request, res: Response) => {
  try {
    if (!ai) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured in the server environment. Please ensure GEMINI_API_KEY is provided.',
      });
    }

    const {
      imageBase64,
      mimeType = 'image/jpeg',
      prompt,
      aspectRatio = '9:16',
      resolution = '720p',
      model = 'veo-3.1-fast-generate-preview',
    } = req.body;

    if (!imageBase64 && !prompt) {
      return res.status(400).json({ error: 'Either an image or a prompt is required.' });
    }

    // Clean base64 string
    let cleanBase64 = imageBase64;
    if (cleanBase64 && cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    const payloadConfig: any = {
      model: model || 'veo-3.1-fast-generate-preview',
      prompt: prompt || 'Living city cinematic motion',
      config: {
        numberOfVideos: 1,
        resolution: resolution === '1080p' ? '1080p' : '720p',
        aspectRatio: aspectRatio === '16:9' ? '16:9' : '9:16',
      },
    };

    if (cleanBase64) {
      payloadConfig.image = {
        imageBytes: cleanBase64,
        mimeType: mimeType || 'image/jpeg',
      };
    }

    const operation = await ai.models.generateVideos(payloadConfig);

    return res.json({
      operationName: operation.name,
      status: 'pending',
    });
  } catch (error: any) {
    console.error('Error initiating video generation:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to start video generation',
    });
  }
});

// Poll video generation status
app.post('/api/video-status', async (req: Request, res: Response) => {
  try {
    if (!ai) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required.' });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });

    const hasVideo = !!updated.response?.generatedVideos?.[0]?.video?.uri;

    return res.json({
      done: !!updated.done,
      error: updated.error || null,
      metadata: updated.metadata || null,
      hasVideo,
    });
  } catch (error: any) {
    console.error('Error polling video operation:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to get video status',
    });
  }
});

// Download / stream video endpoint
app.get('/api/video-stream', async (req: Request, res: Response) => {
  try {
    if (!ai) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const operationName = req.query.operationName as string;
    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required query param' });
    }

    // Check memory cache
    if (videoCache.has(operationName)) {
      const cached = videoCache.get(operationName)!;
      res.setHeader('Content-Type', cached.mimeType || 'video/mp4');
      res.setHeader('Content-Disposition', 'inline; filename="living_city.mp4"');
      return res.send(cached.buffer);
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      return res.status(404).json({ error: 'Video is not yet ready or URI not found.' });
    }

    const videoRes = await fetch(uri, {
      headers: {
        'x-goog-api-key': apiKey,
      },
    });

    if (!videoRes.ok) {
      throw new Error(`Failed to download video from storage: ${videoRes.statusText}`);
    }

    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    videoCache.set(operationName, {
      buffer,
      mimeType: 'video/mp4',
    });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="edinburgh_living_city.mp4"');
    res.setHeader('Content-Length', buffer.length.toString());
    return res.send(buffer);
  } catch (error: any) {
    console.error('Error downloading video stream:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to download video',
    });
  }
});

// Serve sample preset image
app.get('/api/preset/edinburgh', (_req: Request, res: Response) => {
  const filePath = path.resolve(__dirname, 'public/edinburgh-golden-rush.jpg');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    return fs.createReadStream(filePath).pipe(res);
  }
  return res.status(404).send('Not found');
});

// Initialize dev or prod Vite server
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const server = http.createServer(app);

  if (!isProduction) {
    const { createServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 Edinburgh Veo Animator Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
