import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Film,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Play,
  RotateCcw,
  Sliders,
  ChevronRight,
  Maximize2,
  RefreshCw,
  Camera,
  Layers,
  Info,
} from 'lucide-react';
import { AspectRatio, VideoResolution, VeoModel, VideoHistoryItem } from '../types';

interface VeoStudioProps {
  currentImageSrc: string;
  onSelectImage: (src: string, isCustom?: boolean) => void;
  onVideoGenerated: (item: VideoHistoryItem) => void;
}

const DEFAULT_EDINBURGH_PROMPT = `Animate this exact Edinburgh Golden Rush Hour image into a cinematic 15-second vertical video.

CORE PRINCIPLE: THE WORLD ITSELF IS MOVING.

Preserve the original clock tower, illuminated clock face, Gothic spires, historic buildings, street layout, sunset, colours and composition. Keep all architecture structurally stable.

PRIMARY MOTION: Traffic moves naturally along the existing street. Buses and cars advance smoothly within their lanes, maintaining realistic spacing and direction.

SECONDARY MOTION: Pedestrians walk independently along both pavements. Headlights, tail lights and street reflections shift subtly as vehicles move. Clouds drift slowly across the sunset.

MICRO-MOTION: Distant traffic continues moving, small figures remain active in the background, and illuminated windows and streetlights retain their natural glow.

CAMERA: Maintain an almost-locked elevated viewpoint with only an extremely subtle cinematic push-in. The camera must not dominate the motion.

MOTION QUALITY: Natural speed, consistent object identity, realistic vehicle physics, stable architecture and coherent perspective. Animate selectively rather than moving everything.

ENDING: Finish with the same city continuing to live, without an abrupt camera jump or sudden scene transformation.

No new buildings, no duplicated vehicles, no melting architecture, no exaggerated speed, no scene cuts, no text overlays and no artificial transitions.

The result should feel like a real, living Edinburgh city observed at golden hour.`;

export const VeoStudio: React.FC<VeoStudioProps> = ({
  currentImageSrc,
  onSelectImage,
  onVideoGenerated,
}) => {
  const [model, setModel] = useState<VeoModel>('veo-3.1-fast-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [resolution, setResolution] = useState<VideoResolution>('720p');
  const [prompt, setPrompt] = useState<string>(DEFAULT_EDINBURGH_PROMPT);

  // Status & Progress
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [operationName, setOperationName] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  // Polling interval reference
  const pollTimerRef = useRef<any>(null);
  const stageTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  const clearTimers = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (stageTimerRef.current) {
      clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onSelectImage(result, true);
    };
    reader.readAsDataURL(file);
  };

  // Convert current image to base64
  const getImageBase64 = async (): Promise<{ base64: string; mimeType: string }> => {
    if (currentImageSrc.startsWith('data:')) {
      const mime = currentImageSrc.split(';')[0].replace('data:', '');
      return { base64: currentImageSrc, mimeType: mime };
    }

    // Fetch image from local path
    const res = await fetch(currentImageSrc);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          base64: reader.result as string,
          mimeType: blob.type || 'image/jpeg',
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Generation stages labels
  const stageLabels = [
    'Initializing Veo 3.1 generation request...',
    'Analyzing spatial depth & perspective vanishing points...',
    'Locking architectural stability anchor (Clock Tower & Spires)...',
    'Synthesizing Princes Street vehicle lanes & pedestrian physics...',
    'Simulating dusk lighting, wet road reflections & cloud drift...',
    'Rendering living video sequence with Google Veo 3.1...',
  ];

  // Start Generation
  const handleStartGeneration = async () => {
    try {
      setIsGenerating(true);
      setErrorMessage(null);
      setGeneratedVideoUrl(null);
      setGenerationStage(0);
      setStatusMessage(stageLabels[0]);

      // Progress animation
      let currentStage = 0;
      clearTimers();
      stageTimerRef.current = setInterval(() => {
        currentStage = (currentStage + 1) % stageLabels.length;
        setGenerationStage(currentStage);
        setStatusMessage(stageLabels[currentStage]);
      }, 14000);

      const { base64, mimeType } = await getImageBase64();

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          prompt,
          aspectRatio,
          resolution,
          model,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        clearTimers();
        throw new Error(data.error || 'Failed to start video generation.');
      }

      setOperationName(data.operationName);
      setStatusMessage('Veo operation created. Polling video progress...');

      // Start polling backend for operation completion
      pollTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/video-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationName: data.operationName }),
          });

          const pollData = await pollRes.json();

          if (pollData.error) {
            clearTimers();
            setIsGenerating(false);
            setErrorMessage(pollData.error.message || 'Error occurred during generation.');
            return;
          }

          if (pollData.done && pollData.hasVideo) {
            clearTimers();
            setIsGenerating(false);
            setStatusMessage('Video generation completed successfully!');

            const streamUrl = `/api/video-stream?operationName=${encodeURIComponent(data.operationName)}`;
            setGeneratedVideoUrl(streamUrl);

            // Add to history
            const newItem: VideoHistoryItem = {
              id: Date.now().toString(),
              operationName: data.operationName,
              videoUrl: streamUrl,
              thumbnailUrl: currentImageSrc,
              prompt,
              aspectRatio,
              model,
              createdAt: Date.now(),
              durationSeconds: 15,
            };
            onVideoGenerated(newItem);
          }
        } catch (err: any) {
          console.error('Polling error:', err);
        }
      }, 8000);
    } catch (err: any) {
      clearTimers();
      setIsGenerating(false);
      setErrorMessage(err.message || 'An error occurred while generating the video.');
    }
  };

  // Add prompt tag helper
  const addPromptTag = (tag: string) => {
    if (!prompt.includes(tag)) {
      setPrompt((prev) => `${prev.trim()}\n\n${tag}`);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Studio Header Card */}
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-amber-500/20 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-300 mb-2">
              <Film className="w-3.5 h-3.5" />
              Google Veo 3.1 Video Generation Engine
            </div>
            <h2 className="text-2xl font-bold font-cinzel text-neutral-100">
              Animate Photo Into Living Cinematic Video
            </h2>
            <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
              Turn the still Edinburgh Golden Rush Hour masterwork or your own uploaded photo into a continuous, 15-second breathing world with realistic traffic physics and stable historic architecture.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onSelectImage('/edinburgh-golden-rush.jpg', false);
                setPrompt(DEFAULT_EDINBURGH_PROMPT);
                setAspectRatio('9:16');
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-all flex items-center gap-1.5 shadow-lg"
            >
              <Camera className="w-3.5 h-3.5" />
              Edinburgh Golden Rush (Preset)
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-medium hover:bg-neutral-700 transition-all flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Any Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {/* Studio Parameter Config Bar */}
        <div className="mt-6 pt-5 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* 1. Model Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-400 font-medium flex items-center gap-1">
              <span>Veo Model</span>
              <span className="text-amber-400 font-bold">•</span>
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as VeoModel)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:border-amber-500/60 font-mono"
            >
              <option value="veo-3.1-fast-generate-preview">
                veo-3.1-fast-generate-preview (Fast)
              </option>
              <option value="veo-3.1-lite-generate-preview">
                veo-3.1-lite-generate-preview (Lite)
              </option>
              <option value="veo-3.1-generate-preview">
                veo-3.1-generate-preview (High-Fidelity)
              </option>
            </select>
          </div>

          {/* 2. Aspect Ratio Selector (9:16 or 16:9 as instructed) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-400 font-medium">Aspect Ratio</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  aspectRatio === '9:16'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                9:16 (Portrait / Reels)
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  aspectRatio === '16:9'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                16:9 (Landscape)
              </button>
            </div>
          </div>

          {/* 3. Resolution */}
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-400 font-medium">Resolution</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setResolution('720p')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  resolution === '720p'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                720p HD (Quick)
              </button>
              <button
                type="button"
                onClick={() => setResolution('1080p')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  resolution === '1080p'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                1080p Full HD
              </button>
            </div>
          </div>

          {/* 4. Motion Duration */}
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-400 font-medium">Duration & Camera</label>
            <div className="py-2 px-3 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 font-mono flex items-center justify-between">
              <span>15 Seconds</span>
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                Slow Push-In
              </span>
            </div>
          </div>
        </div>

        {/* Prompt Input Box */}
        <div className="mt-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <span>Cinematic Motion Prompt</span>
              <span className="text-[10px] text-amber-400 font-normal">
                (Specifies physics, vehicle lanes, architecture stability, and elevated camera)
              </span>
            </label>
            <button
              onClick={() => setPrompt(DEFAULT_EDINBURGH_PROMPT)}
              className="text-[11px] text-neutral-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Edinburgh Master Prompt
            </button>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-amber-500/70 rounded-xl p-3.5 text-xs text-neutral-200 leading-relaxed font-mono focus:outline-none transition-all shadow-inner"
            placeholder="Describe the cinematic motion you want Veo to synthesize..."
          />

          {/* Quick Modifier Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            <span className="text-neutral-500 font-medium">Quick Prompts:</span>
            <button
              type="button"
              onClick={() => addPromptTag('KEEP ARCHITECTURE 100% RIGID AND ANCHORED. NO MELTING BUILDINGS.')}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-amber-500/40 transition-colors"
            >
              + Anchor Historic Spires
            </button>
            <button
              type="button"
              onClick={() => addPromptTag('REALISTIC LOTHIAN BUS AND CAR SPEEDS WITH NATURAL BRAKING AND HEADLIGHTS.')}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-amber-500/40 transition-colors"
            >
              + Lothian Bus Physics
            </button>
            <button
              type="button"
              onClick={() => addPromptTag('DUSK SUNSET CLOUDS DRIFT SLOWLY TOWARDS THE WEST WITH WARM GOLDEN AMBIANCE.')}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-amber-500/40 transition-colors"
            >
              + Sunset Cloud Drift
            </button>
            <button
              type="button"
              onClick={() => addPromptTag('SUBTLE ELEVATED TELEPHOTO CAMERA PUSH-IN OVER 15 SECONDS WITHOUT ROTATION.')}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-amber-500/40 transition-colors"
            >
              + Subtle Push-In
            </button>
          </div>
        </div>

        {/* Generate Button & Progress State */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleStartGeneration}
            disabled={isGenerating}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl transition-all ${
              isGenerating
                ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-700'
                : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-neutral-950 hover:brightness-110 active:scale-[0.99] font-cinzel text-base tracking-wide'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                <span>Synthesizing Video with Google Veo 3.1...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 fill-current" />
                <span>Generate 15-Second Cinematic Video</span>
              </>
            )}
          </button>

          {/* Progress / Status Display */}
          {isGenerating && (
            <div className="p-4 rounded-xl bg-neutral-950/80 border border-amber-500/30 flex flex-col gap-3 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-300 font-semibold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  Stage {generationStage + 1} of {stageLabels.length}
                </span>
                <span className="text-neutral-400 font-mono">
                  {statusMessage}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700"
                  style={{
                    width: `${Math.min(95, ((generationStage + 1) / stageLabels.length) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex items-start gap-2 text-[11px] text-neutral-400 pt-1">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Video generation with Veo 3.1 synthesizes full motion physics across 15 seconds. Please keep this tab active while the video renders.
                </span>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-300">Generation Note</p>
                <p className="mt-0.5 text-neutral-300">{errorMessage}</p>
                <p className="mt-2 text-[11px] text-neutral-400">
                  You can also preview and interact with the real-time Living City Motion Engine above anytime with zero waiting!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generated Video Showcase (When Ready) */}
      {generatedVideoUrl && (
        <div className="p-6 rounded-2xl bg-neutral-900/90 border border-amber-500/40 backdrop-blur-xl flex flex-col gap-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Generated Veo 3.1 Cinematic Video Ready</span>
            </div>

            <a
              href={generatedVideoUrl}
              download="edinburgh_living_city.mp4"
              className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-lg"
            >
              <Download className="w-4 h-4" />
              Download MP4
            </a>
          </div>

          <div className="relative max-h-[75vh] w-full flex justify-center bg-black rounded-xl overflow-hidden border border-neutral-800">
            <video
              ref={videoPlayerRef}
              src={generatedVideoUrl}
              controls
              autoPlay
              loop
              playsInline
              className={`max-h-[70vh] object-contain ${
                aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-[16/9]'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
