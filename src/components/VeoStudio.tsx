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
  Compass,
  Check,
} from 'lucide-react';
import { AspectRatio, VideoResolution, VeoModel, VideoHistoryItem, CityPreset } from '../types';
import { CITY_PRESETS } from '../data/presets';

interface VeoStudioProps {
  currentImageSrc: string;
  onSelectImage: (src: string, isCustom?: boolean) => void;
  onVideoGenerated: (item: VideoHistoryItem) => void;
}

export const VeoStudio: React.FC<VeoStudioProps> = ({
  currentImageSrc,
  onSelectImage,
  onVideoGenerated,
}) => {
  const [model, setModel] = useState<VeoModel>('veo-3.1-lite-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [resolution, setResolution] = useState<VideoResolution>('720p');
  const [prompt, setPrompt] = useState<string>(CITY_PRESETS[0].prompt);
  const [activePresetId, setActivePresetId] = useState<string>(CITY_PRESETS[0].id);

  // Status & Progress
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [operationName, setOperationName] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Polling reference
  const pollTimeoutRef = useRef<any>(null);
  const stageTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const pollStartRef = useRef<number>(0);

  const clearTimers = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (stageTimerRef.current) {
      clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const handleSelectPreset = (preset: CityPreset) => {
    setActivePresetId(preset.id);
    onSelectImage(preset.imageSrc, false);
    setPrompt(preset.prompt);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setActivePresetId('custom');
      onSelectImage(result, true);
    };
    reader.readAsDataURL(file);
  };

  const getImageBase64 = async (): Promise<{ base64: string; mimeType: string }> => {
    if (currentImageSrc.startsWith('data:')) {
      const mime = currentImageSrc.split(';')[0].replace('data:', '');
      return { base64: currentImageSrc, mimeType: mime };
    }

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

  const stageLabels = [
    'Initializing Veo 3.1 generation pipeline...',
    'Locking architectural rigidity & perspective vanishing point...',
    'Synthesizing vehicle lane momentum & pedestrian physics...',
    'Simulating dusk lighting, wet asphalt reflections & cloud drift...',
    'Rendering living video master with Google Veo 3.1...',
  ];

  const handleStartGeneration = async () => {
    try {
      setIsGenerating(true);
      setErrorMessage(null);
      setGeneratedVideoUrl(null);
      setGenerationStage(0);
      setStatusMessage(stageLabels[0]);
      pollStartRef.current = Date.now();

      let currentStage = 0;
      clearTimers();
      stageTimerRef.current = setInterval(() => {
        currentStage = (currentStage + 1) % stageLabels.length;
        setGenerationStage(currentStage);
        setStatusMessage(stageLabels[currentStage]);
      }, 12000);

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
        setIsGenerating(false);
        setIsQuotaError(data.code === 'RESOURCE_EXHAUSTED' || !!data.isQuotaExceeded);
        setErrorMessage(data.error || 'Failed to start video generation.');
        return;
      }

      setOperationName(data.operationName);
      setStatusMessage('Veo operation active. Synthesizing living city motion...');

      // Self-scheduling polling loop with 6-minute timeout safeguard
      const pollProgress = async () => {
        if (Date.now() - pollStartRef.current > 360000) {
          clearTimers();
          setIsGenerating(false);
          setErrorMessage('Video generation timed out after 6 minutes. Please try again.');
          return;
        }

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
            setIsQuotaError(pollData.code === 'RESOURCE_EXHAUSTED' || !!pollData.isQuotaExceeded);
            setErrorMessage(pollData.error.message || pollData.error || 'Error occurred during Veo generation.');
            return;
          }

          if (pollData.done && pollData.hasVideo) {
            clearTimers();
            setIsGenerating(false);
            setStatusMessage('Living video generation completed successfully!');

            const streamUrl = `/api/video-stream?operationName=${encodeURIComponent(data.operationName)}`;
            setGeneratedVideoUrl(streamUrl);

            const newItem: VideoHistoryItem = {
              id: Date.now().toString(),
              operationName: data.operationName,
              videoUrl: streamUrl,
              thumbnailUrl: currentImageSrc,
              prompt,
              aspectRatio,
              model,
              createdAt: Date.now(),
              durationSeconds: pollData.durationSeconds || 6,
            };
            onVideoGenerated(newItem);
            return;
          }

          // Schedule next poll in 8 seconds
          pollTimeoutRef.current = setTimeout(pollProgress, 8000);
        } catch (err: any) {
          console.error('Polling error:', err);
          pollTimeoutRef.current = setTimeout(pollProgress, 8000);
        }
      };

      pollTimeoutRef.current = setTimeout(pollProgress, 8000);
    } catch (err: any) {
      clearTimers();
      setIsGenerating(false);
      setErrorMessage(err.message || 'An error occurred while generating the video.');
    }
  };

  const handleDownloadMp4 = async () => {
    if (!generatedVideoUrl) return;
    try {
      setIsDownloading(true);
      const url = generatedVideoUrl.includes('?')
        ? `${generatedVideoUrl}&download=1`
        : `${generatedVideoUrl}?download=1`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = objectUrl;
      a.download = 'edinburgh_living_city.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);
    } catch {
      window.location.href = `${generatedVideoUrl}&download=1`;
    } finally {
      setTimeout(() => setIsDownloading(false), 1200);
    }
  };

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

        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-300 mb-2">
                <Film className="w-3.5 h-3.5" />
                Google Veo 3.1 Video Generation Studio
              </div>
              <h2 className="text-2xl font-bold font-cinzel text-neutral-100">
                Animate Photo Into Living Cinematic Video
              </h2>
              <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
                Transform Edinburgh landmark scenes or your own uploaded photography into a high-fidelity living cinematic video with authentic traffic physics and anchored historic architecture.
              </p>
            </div>

            <div className="flex items-center gap-2">
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

          {/* Curated Landmark Worlds Selector */}
          <div className="flex flex-col gap-2 pt-2">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>Select Curated Landmark Scene:</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {CITY_PRESETS.map((preset) => {
                const isSelected = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/60 shadow-lg text-amber-200 ring-1 ring-amber-500/40'
                        : 'bg-neutral-950/80 border-neutral-800 text-neutral-400 hover:border-amber-500/30 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 font-bold">
                        {preset.badge}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <span className="text-xs font-bold text-neutral-100">{preset.name}</span>
                    <span className="text-[10px] text-neutral-400 line-clamp-1">{preset.landmark}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Studio Parameter Config Bar */}
        <div className="mt-6 pt-5 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Model Selector */}
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

          {/* Aspect Ratio Selector */}
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
                9:16 (Vertical Reel)
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

          {/* Resolution */}
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
                720p HD
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

          {/* Master Clip Duration */}
          <div className="flex flex-col gap-1.5">
            <label className="text-neutral-400 font-medium">Clip Duration</label>
            <div className="py-2 px-3 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 font-mono flex items-center justify-between">
              <span>6 Seconds Master</span>
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                Seamless Loop
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
                (Specifies vehicle physics, architectural rigidity, and lighting)
              </span>
            </label>
            <button
              onClick={() => {
                const current = CITY_PRESETS.find((p) => p.id === activePresetId);
                setPrompt(current ? current.prompt : CITY_PRESETS[0].prompt);
              }}
              className="text-[11px] text-neutral-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Scene Prompt
            </button>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-amber-500/70 rounded-xl p-3.5 text-xs text-neutral-200 leading-relaxed font-mono focus:outline-none transition-all shadow-inner"
            placeholder="Describe the cinematic motion you want Veo to synthesize..."
          />

          {/* Creative Modifier Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            <span className="text-neutral-500 font-medium">Prompt Modifiers:</span>
            <button
              type="button"
              onClick={() => addPromptTag('KEEP ARCHITECTURE 100% RIGID AND ANCHORED. ZERO MORPHING FACADES.')}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-amber-500/40 transition-colors"
            >
              + Anchor Spires
            </button>
            <button
              type="button"
              onClick={() => addPromptTag('DOUBLE-DECKER LOTHIAN BUSES AND EDINBURGH BLACK CABS WITH NATURAL BRAKING AND HEADLIGHTS.')}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-amber-500/40 transition-colors"
            >
              + Lothian Bus Dynamics
            </button>
            <button
              type="button"
              onClick={() => addPromptTag('GENTLE SCOTTISH DRIZZLE WITH SHIMMERING WET COBBLESTONES AND AMBER ROAD REFLECTIONS.')}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-amber-500/40 transition-colors"
            >
              + Wet Pavement Shimmer
            </button>
            <button
              type="button"
              onClick={() => addPromptTag('VOLUMETRIC COASTAL SEA MIST (THE HAAR) DRIFTING THROUGH HISTORIC GOTHIC ARCHITECTURE.')}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-amber-500/40 transition-colors"
            >
              + Coastal Sea Mist
            </button>
            <button
              type="button"
              onClick={() => addPromptTag('SUBTLE ELEVATED 35MM TELEPHOTO PERSPECTIVE WITH SLOW 4% PUSH-IN OVER 6 SECONDS.')}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-amber-500/40 transition-colors"
            >
              + 35mm Telephoto Push-In
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
                <span>Synthesizing Living City Video with Google Veo 3.1...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 fill-current" />
                <span>Generate Cinematic Living Video</span>
              </>
            )}
          </button>

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
                  Veo 3.1 synthesizes real vehicle physics, pedestrian walking cadence, and volumetric lighting across the frame. Please keep this tab active while your video renders.
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              className={`p-4 rounded-xl text-xs flex items-start gap-3 border transition-all ${
                isQuotaError
                  ? 'bg-amber-950/25 border-amber-500/50 text-amber-100 shadow-xl'
                  : 'bg-red-950/40 border-red-500/40 text-red-200'
              }`}
            >
              <AlertCircle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isQuotaError ? 'text-amber-400' : 'text-red-400'
                }`}
              />
              <div className="flex-1 flex flex-col gap-1.5">
                <p className={`font-semibold ${isQuotaError ? 'text-amber-300' : 'text-red-300'}`}>
                  {isQuotaError ? 'Google Veo 3.1 API Quota Exceeded (429)' : 'Generation Notice'}
                </p>
                <p className="text-neutral-300 leading-relaxed">{errorMessage}</p>

                {isQuotaError ? (
                  <div className="mt-2 pt-2 border-t border-amber-500/20 flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="text-neutral-400">
                      Veo video generation requires paid API tier quota.
                    </span>
                    <a
                      href="https://ai.google.dev/gemini-api/docs/rate-limits"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 underline font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      View Gemini API Quotas & Billing
                    </a>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-neutral-400">
                    You can explore real-time physics and environmental atmospheres in the Living Motion Engine anytime with zero waiting!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generated Video Showcase */}
      {generatedVideoUrl && (
        <div className="p-6 rounded-2xl bg-neutral-900/90 border border-amber-500/40 backdrop-blur-xl flex flex-col gap-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Generated Veo 3.1 Cinematic Video Ready</span>
            </div>

            <button
              onClick={handleDownloadMp4}
              disabled={isDownloading}
              className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-lg"
            >
              <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
              <span>{isDownloading ? 'Saving MP4...' : 'Download MP4'}</span>
            </button>
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
