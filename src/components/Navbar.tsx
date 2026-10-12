import React, { useState, useEffect } from 'react';
import { Sparkles, Film, Compass, Clock, MapPin, LogIn, LogOut, User as UserIcon, Database } from 'lucide-react';
import { User } from 'firebase/auth';

interface NavbarProps {
  activeTab: 'motion' | 'veo' | 'guide';
  setActiveTab: (tab: 'motion' | 'veo' | 'guide') => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogin,
  onLogout,
}) => {
  const [edinburghTime, setEdinburghTime] = useState<string>('17:42:15');

  // Realistic Edinburgh Golden Hour Clock (Dusk rush hour: 17:42 - 17:57)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const secs = String(now.getSeconds()).padStart(2, '0');
      const mins = String((now.getMinutes() % 15) + 42).padStart(2, '0');
      setEdinburghTime(`17:${mins}:${secs} GMT`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="w-full border-b border-amber-500/20 bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-500/20 border border-amber-400/40">
            <span className="text-xl">🏰</span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-cinzel font-bold text-base sm:text-lg tracking-wider text-neutral-100">
                EDINBURGH
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                Veo 3.1
              </span>
            </div>
            <span className="text-[11px] text-neutral-400 flex items-center gap-1 font-mono">
              <MapPin className="w-3 h-3 text-amber-400" />
              Princes Street & Balmoral Clock Tower
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-neutral-900/90 border border-neutral-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('motion')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'motion'
                ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">15s Living Motion</span>
            <span className="sm:hidden">Motion</span>
          </button>

          <button
            onClick={() => setActiveTab('veo')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'veo'
                ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Veo 3.1 Generator</span>
            <span className="sm:hidden">Veo Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'guide'
                ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Motion Principles</span>
            <span className="sm:hidden">Guide</span>
          </button>
        </nav>

        {/* Firebase Auth & Cloud Sync */}
        <div className="flex items-center gap-3">
          {/* Live Edinburgh Golden Hour Clock */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-amber-500/20 text-xs font-mono text-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Rush Hour: {edinburghTime}</span>
          </div>

          {/* Firestore Status Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Database className="w-3 h-3 text-emerald-400" />
            <span>Firestore</span>
          </div>

          {user ? (
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-6 h-6 rounded-full border border-amber-500/40 object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </div>
              )}
              <span className="text-xs text-neutral-300 font-medium hidden sm:inline max-w-[100px] truncate">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <button
                onClick={onLogout}
                title="Sign out of Firebase"
                className="p-1 text-neutral-400 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign in with Google</span>
              <span className="sm:hidden">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
