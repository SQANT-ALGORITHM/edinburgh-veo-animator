import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { LivingCanvas } from './components/LivingCanvas';
import { VeoStudio } from './components/VeoStudio';
import { PromptGuide } from './components/PromptGuide';
import { HistoryGallery } from './components/HistoryGallery';
import { VideoHistoryItem, TimeOfDay, WeatherEffect, CityPreset } from './types';
import { CITY_PRESETS } from './data/presets';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  saveVideoToFirestore,
  subscribeToCommunityVideos,
} from './firebase';
import {
  Sparkles,
  Camera,
  Film,
  Compass,
  ArrowRight,
  Shield,
  Layers,
  Clock,
  Eye,
  Sliders,
  Database,
  Check,
  Sun,
  CloudRain,
  MapPin,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'motion' | 'veo' | 'guide'>('motion');
  const [currentImageSrc, setCurrentImageSrc] = useState<string>('/edinburgh-golden-rush.jpg');
  const [isCustomImage, setIsCustomImage] = useState<boolean>(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(CITY_PRESETS[0].id);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('golden_hour');
  const [weather, setWeather] = useState<WeatherEffect>('clear');
  const [history, setHistory] = useState<VideoHistoryItem[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Sync videos with Firestore in real-time
  useEffect(() => {
    const unsubscribe = subscribeToCommunityVideos((firestoreVideos) => {
      if (firestoreVideos && firestoreVideos.length > 0) {
        setHistory((prev) => {
          const map = new Map<string, VideoHistoryItem>();
          firestoreVideos.forEach((v) => map.set(v.id, v));
          prev.forEach((v) => {
            if (!map.has(v.id)) map.set(v.id, v);
          });
          return Array.from(map.values());
        });
      }
    });

    try {
      const saved = localStorage.getItem('edinburgh_veo_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // ignore
    }

    return () => unsubscribe();
  }, []);

  const handleVideoGenerated = async (item: VideoHistoryItem) => {
    const updated = [item, ...history];
    setHistory(updated);
    try {
      localStorage.setItem('edinburgh_veo_history', JSON.stringify(updated));
    } catch {
      // ignore
    }

    if (user) {
      try {
        await saveVideoToFirestore(item, user);
      } catch (err) {
        console.warn('Could not save video to Firestore:', err);
      }
    }
  };

  const handleLogin = async () => {
    try {
      const loggedUser = await loginWithGoogle();
      if (loggedUser) {
        setUser(loggedUser);
      }
    } catch {
      // Handled gracefully in loginWithGoogle
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
    } catch {
      // Handled gracefully in logoutUser
    }
  };

  const handleSelectHistoryVideo = (item: VideoHistoryItem) => {
    setCurrentImageSrc(item.thumbnailUrl);
    setActiveTab('veo');
  };

  const handleSelectPreset = (preset: CityPreset) => {
    setSelectedPresetId(preset.id);
    setCurrentImageSrc(preset.imageSrc);
    setIsCustomImage(false);
    setTimeOfDay(preset.timeOfDay);
    setWeather(preset.weather);
  };

  const activePreset = CITY_PRESETS.find((p) => p.id === selectedPresetId) || CITY_PRESETS[0];

  return (
    <div className="min-h-screen bg-[#090b10] text-[#e2e8f0] flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* Hero Atmosphere Banner */}
      <section className="relative overflow-hidden border-b border-amber-500/10 bg-gradient-to-b from-neutral-950 via-[#0c0e17] to-[#090b10] py-8 sm:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-300 mb-3">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>Living City Video Generator • Powered by Google Veo 3.1</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-cinzel text-neutral-100 tracking-tight leading-tight">
                Edinburgh Veo Animator
              </h1>
              <p className="mt-2 text-sm sm:text-base text-neutral-300 leading-relaxed max-w-2xl">
                The world itself is moving. Create cinematic living-city scenes with AI-powered video generation and environmental motion tools. Built for creative experimentation with vertical video, detailed illustrated worlds, and motion-rich visual storytelling.
              </p>
            </div>

            {/* Quick Action Badges */}
            <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('motion')}
                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 transition-all ${
                  activeTab === 'motion'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg'
                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:border-amber-500/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Interactive Motion Engine</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => setActiveTab('veo')}
                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 transition-all ${
                  activeTab === 'veo'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg'
                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:border-amber-500/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-400" />
                  <span>Veo 3.1 Video Studio</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </div>

          {/* Quick Landmark World Pills */}
          <div className="mt-6 pt-5 border-t border-neutral-800/80 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-400 font-medium flex items-center gap-1.5 mr-1">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Living Worlds:</span>
            </span>
            {CITY_PRESETS.map((p) => {
              const isSelected = selectedPresetId === p.id && !isCustomImage;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p)}
                  className={`px-3 py-1.5 rounded-xl border text-xs transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500/25 border-amber-500/60 text-amber-200 font-bold shadow-md'
                      : 'bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:border-amber-500/30 hover:text-neutral-100'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-10">
        {activeTab === 'motion' && (
          <div className="flex flex-col gap-8 animate-fade-in">
            {/* Living Canvas Viewer */}
            <div className="w-full">
              <LivingCanvas
                imageSrc={currentImageSrc}
                isCustomImage={isCustomImage}
                timeOfDay={timeOfDay}
                weather={weather}
                onTimeOfDayChange={setTimeOfDay}
                onWeatherChange={setWeather}
                onVideoRecorded={handleVideoGenerated}
              />
            </div>

            {/* Architecture Stabilization & Motion Physics Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Rigid Architecture Anchor</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  The iconic Balmoral Victorian clock tower, illuminated glowing clock face, and Scott Monument Gothic spires remain 100% structurally solid with zero melting or morphing.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Lothian Traffic Perspective</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Double-decker buses and cars advance smoothly along Princes Street’s true perspective lanes with authentic speeds, headlight projections, and wet road reflections.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span>Cinematic Push-In & Looping</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Elevated vantage point with an imperceptible 4.5% cinematic push-in. Finishes seamlessly with the Scottish capital continuing to live and breathe.
                </p>
              </div>
            </div>

            {/* Jump into Veo Studio banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-neutral-900/80 to-neutral-950 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold font-cinzel text-neutral-100">
                  Ready to Render with Google Veo 3.1?
                </h4>
                <p className="text-xs text-neutral-300 mt-1 max-w-xl">
                  Send this exact photo or upload any image to the Veo 3.1 video generation engine with custom aspect ratios (9:16 or 16:9) and real-time status polling.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('veo')}
                className="px-5 py-3 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg shrink-0 font-cinzel tracking-wider"
              >
                <Film className="w-4 h-4" />
                Launch Veo 3.1 Studio
              </button>
            </div>

            {/* Generation History */}
            <HistoryGallery
              history={history}
              onSelectVideo={handleSelectHistoryVideo}
            />
          </div>
        )}

        {activeTab === 'veo' && (
          <div className="flex flex-col gap-8 animate-fade-in">
            <VeoStudio
              currentImageSrc={currentImageSrc}
              onSelectImage={(src, isCustom) => {
                setCurrentImageSrc(src);
                setIsCustomImage(!!isCustom);
              }}
              onVideoGenerated={handleVideoGenerated}
            />

            <HistoryGallery
              history={history}
              onSelectVideo={handleSelectHistoryVideo}
            />
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <PromptGuide />
          </div>
        )}
      </main>

      {/* Atmospheric Footer */}
      <footer className="w-full border-t border-neutral-900 bg-neutral-950/90 py-8 mt-12 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-cinzel text-neutral-300 font-bold">EDINBURGH</span>
            <span>•</span>
            <span>Living City Video Generator</span>
            <span>•</span>
            <span>Powered by Google Veo 3.1</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-400">
            <span>Aspect Ratio: 9:16 & 16:9</span>
            <span>•</span>
            <span>Continuous Motion Loop</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
