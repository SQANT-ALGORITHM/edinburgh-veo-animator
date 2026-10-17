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

// ============================================================
// SECURITY: Keep GEMINI_API_KEY server-side only
// ============================================================
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

// ============================================================
// Helper: Map Google API error codes to HTTP status codes
// ============================================================
function mapGoogleErrorToHttpStatus(error: any): { status: number; message: string; code: string } {
  const code = error?.code || error?.status || 'UNKNOWN';
  const message = error?.message || 'An unknown error occurred';

  // Extract upstream error details without exposing credentials
  if (code === 'INVALID_ARGUMENT' || code === 400) {
    return {
      status: 400,
      message: 'Invalid request parameters. Ensure image and model settings are correct.',
      code: 'INVALID_ARGUMENT',
    };
  }
  if (code === 'UNAUTHENTICATED' || code === 401) {
    return {
      status: 401,
      message: 'API authentication failed. Verify GEMINI_API_KEY configuration.',
      code: 'UNAUTHENTICATED',
    };
  }
  if (code === 'PERMISSION_DENIED' || code === 403) {
    return {
      status: 403,
      message: 'Access denied. Check API permissions and billing status.',
      code: 'PERMISSION_DENIED',
    };
  }
  if (code === 'RESOURCE_EXHAUSTED' || code === 429) {
    return {
      status: 429,
      message: 'API quota exhausted. Please try again later.',
      code: 'RESOURCE_EXHAUSTED',
    };
  }
  if (code === 'DEADLINE_EXCEEDED' || code === 504) {
    return {
      status: 504,
      message: 'Generation request timed out. Please try again.',
      code: 'DEADLINE_EXCEEDED',
    };
  }
  // Default for unhandled errors
  return {
    status: 500,
    message: 'An internal server error occurred during video generation.',
    code: 'INTERNAL_ERROR',
  };
}

// ============================================================
// Health / Config endpoint
// ============================================================
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    hasApiKey: !!process.env.GEMINI_API_KEY,
    defaultModel: 'veo-3.1-fast-generate-preview',
    supportedModels: [
      { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast (Recommended)', tag: 'Fast', supportedDuration: '6 seconds' },
      { id: 'veo-3.1-lite-generate-preview', name: 'Veo 3.1 Lite', tag: 'Standard', supportedDuration: '6 seconds' },
      { id: 'veo-3.1-generate-preview', name: 'Veo 3.1 Cinematic Quality', tag: 'High-Res', supportedDuration: '6 seconds' },
    ],
    supportedAspectRatios: ['9:16', '16:9'],
    supportedResolutions: ['720p', '1080p'],
    noteSingleClipDuration: 'Google Veo 3.1 API supports single clips up to 6 seconds. For 15-second sequences, use multi-clip generation workflow.',
  });
});

// ============================================================
// Start video generation
// Validates duration support and handles model-specific constraints
// ============================================================
app.post('/api/generate-video', async (req: Request, res: Response) => {
  try {
    if (!ai) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured in the server environment.',
        code: 'MISSING_API_KEY',
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

    // Validate inputs
    if (!imageBase64 && !prompt) {
      return res.status(400).json({
        error: 'Either an image or a prompt is required.',
        code: 'INVALID_ARGUMENT',
      });
    }

    if (!['9:16', '16:9'].includes(aspectRatio)) {
      return res.status(400).json({
        error: 'Aspect ratio must be 9:16 or 16:9.',
        code: 'INVALID_ARGUMENT',
      });
    }

    if (!['720p', '1080p'].includes(resolution)) {
      return res.status(400).json({
        error: 'Resolution must be 720p or 1080p.',
        code: 'INVALID_ARGUMENT',
      });
    }

    // Clean base64 string
    let cleanBase64 = imageBase64;
    if (cleanBase64 && cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    // ============================================================
    // Construct payload with validated duration (6 seconds per Veo 3.1 API)
    // Do NOT claim 15 seconds unless multi-clip workflow is implemented
    // ============================================================
    const payloadConfig: any = {
      model: model || 'veo-3.1-fast-generate-preview',
      prompt: prompt || 'Living city cinematic motion',
      config: {
        numberOfVideos: 1,
        resolution: resolution === '1080p' ? '1080p' : '720p',
        aspectRatio: aspectRatio === '16:9' ? '16:9' : '9:16',
        // NOTE: Google Veo 3.1 API currently supports up to 6 seconds per generation.
        // For 15-second videos, implement multi-clip generation and stitching.
        duration: '6s',
      },
    };

    if (cleanBase64) {
      payloadConfig.image = {
        imageBytes: cleanBase64,
        mimeType: mimeType || 'image/jpeg',
      };
    }

    try {
      const operation = await ai.models.generateVideos(payloadConfig);

      return res.status(202).json({
        operationName: operation.name,
        status: 'pending',
        durationSeconds: 6,
        note: 'Video generation initiated. Use /api/video-status to poll progress.',
      });
    } catch (apiError: any) {
      const { status, message, code } = mapGoogleErrorToHttpStatus(apiError);
      
      // Log full error server-side for debugging (never expose to client beyond mapped message)
      console.error(`[Veo API Error] ${code}:`, {
        originalMessage: apiError?.message,
        details: apiError?.details,
        timestamp: new Date().toISOString(),
      });

      return res.status(status).json({
        error: message,
        code,
        // Do NOT include upstream API key, full error object, or internal details
      });
    }
  } catch (error: any) {
    console.error('Unexpected error in /api/generate-video:', error?.message);
    return res.status(500).json({
      error: 'An unexpected error occurred while starting video generation.',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ============================================================
// Poll video generation status
// ============================================================
app.post('/api/video-status', async (req: Request, res: Response) => {
  try {
    if (!ai) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured.',
        code: 'MISSING_API_KEY',
      });
    }

    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({
        error: 'operationName is required.',
        code: 'INVALID_ARGUMENT',
      });
    }

    try {
      const op = new GenerateVideosOperation();
      op.name = operationName;

      const updated = await ai.operations.getVideosOperation({ operation: op });

      const hasVideo = !!updated.response?.generatedVideos?.[0]?.video?.uri;
      const duration = (updated.response?.generatedVideos?.[0] as any)?.generatedMetadata?.generatedDurationSeconds || 6;

      return res.json({
        done: !!updated.done,
        error: updated.error || null,
        metadata: updated.metadata || null,
        hasVideo,
        durationSeconds: duration,
        // Only claim success if a real video URI is present
        videoReady: hasVideo && updated.done,
      });
    } catch (apiError: any) {
      const { status, message, code } = mapGoogleErrorToHttpStatus(apiError);
      
      console.error(`[Veo API Error in Status Polling] ${code}:`, {
        operationName,
        originalMessage: apiError?.message,
        timestamp: new Date().toISOString(),
      });

      return res.status(status).json({
        error: message,
        code,
        done: false,
      });
    }
  } catch (error: any) {
    console.error('Unexpected error in /api/video-status:', error?.message);
    return res.status(500).json({
      error: 'An unexpected error occurred while checking video status.',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ============================================================
// Download / stream video endpoint
// Verifies video exists before returning to client
// ============================================================
app.get('/api/video-stream', async (req: Request, res: Response) => {
  try {
    if (!ai) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured.',
        code: 'MISSING_API_KEY',
      });
    }

    const operationName = req.query.operationName as string;
    if (!operationName) {
      return res.status(400).json({
        error: 'operationName is required query param.',
        code: 'INVALID_ARGUMENT',
      });
    }

    // Check memory cache
    if (videoCache.has(operationName)) {
      const cached = videoCache.get(operationName)!;
      res.setHeader('Content-Type', cached.mimeType || 'video/mp4');
      res.setHeader('Content-Disposition', 'inline; filename="edinburgh_veo.mp4"');
      res.setHeader('Content-Length', cached.buffer.length.toString());
      return res.send(cached.buffer);
    }

    try {
      const op = new GenerateVideosOperation();
      op.name = operationName;

      const updated = await ai.operations.getVideosOperation({ operation: op });

      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) {
        return res.status(404).json({
          error: 'Video is not yet ready or URI not found. Check operation status first.',
          code: 'NOT_FOUND',
        });
      }

      // Verify generation is complete
      if (!updated.done) {
        return res.status(202).json({
          error: 'Video generation is still in progress. Please try again shortly.',
          code: 'STILL_PROCESSING',
        });
      }

      // ============================================================
      // Download video using server-side API key (never expose to browser)
      // ============================================================
      const videoRes = await fetch(uri, {
        headers: {
          'x-goog-api-key': apiKey,
        },
      });

      if (!videoRes.ok) {
        const { status, message, code } = mapGoogleErrorToHttpStatus({
          status: videoRes.status,
          message: `Failed to download video from storage: ${videoRes.statusText}`,
        });
        throw new Error(message);
      }

      const arrayBuffer = await videoRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Validate buffer is not empty
      if (buffer.length === 0) {
        return res.status(500).json({
          error: 'Downloaded video buffer is empty. Generation may have failed.',
          code: 'EMPTY_VIDEO',
        });
      }

      // Cache for future requests
      videoCache.set(operationName, {
        buffer,
        mimeType: 'video/mp4',
      });

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'inline; filename="edinburgh_veo.mp4"');
      res.setHeader('Content-Length', buffer.length.toString());
      return res.send(buffer);
    } catch (apiError: any) {
      const { status, message, code } = mapGoogleErrorToHttpStatus(apiError);
      
      console.error(`[Veo API Error in Video Stream] ${code}:`, {
        operationName,
        originalMessage: apiError?.message,
        timestamp: new Date().toISOString(),
      });

      return res.status(status).json({
        error: message,
        code,
      });
    }
  } catch (error: any) {
    console.error('Unexpected error in /api/video-stream:', error?.message);
    return res.status(500).json({
      error: 'An unexpected error occurred while downloading the video.',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ============================================================
// Serve sample preset image
// ============================================================
app.get('/api/preset/edinburgh', (_req: Request, res: Response) => {
  const filePath = path.resolve(__dirname, 'public/edinburgh-golden-rush.jpg');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    return fs.createReadStream(filePath).pipe(res);
  }
  return res.status(404).json({ error: 'Preset image not found.' });
});

// ============================================================
// Initialize dev or prod Vite server
// ============================================================
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
    console.log(`📖 API Documentation: /api/config`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
