import React from 'react';
import {
  Compass,
  ShieldCheck,
  Truck,
  Users,
  SunMedium,
  Camera,
  Film,
  Sparkles,
} from 'lucide-react';

export const PromptGuide: React.FC = () => {
  return (
    <div className="w-full flex flex-col gap-6 py-4">
      {/* Overview Card */}
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-amber-500/20 backdrop-blur-md">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="w-4 h-4" />
          <span>Cinematic Motion Design Constitution</span>
        </div>
        <h3 className="text-xl font-bold font-cinzel text-neutral-100">
          Core Principle: The World Itself Is Moving
        </h3>
        <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
          Rather than introducing artificial camera spins or surreal warping, the camera remains grounded at the elevated Calton Hill vantage point. The living energy comes from the authentic rhythm of Edinburgh rush hour at dusk.
        </p>

        {/* 6 Key Pillars Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Architectural Rigidity</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Balmoral Victorian Clock Tower, Scott Monument spires, and Princes Street stone facades remain structurally static. Zero melting walls or morphing parapets.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Primary Traffic Physics</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Lothian double-decker buses and cars travel in true perspective lanes. Foreground vehicles move faster than distant vehicles at the horizon.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
              <Users className="w-4 h-4 text-sky-400" />
              <span>Pedestrian Independence</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Foot traffic along both pavements moves with human cadence in both directions. No duplicated clones; distinct commuter silhouettes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
              <SunMedium className="w-4 h-4 text-orange-400" />
              <span>Wet Road & Light Reflections</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Headlights project amber beams onto damp asphalt. Taillights leave soft crimson trails, and wet street reflections shimmer dynamically.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
              <Camera className="w-4 h-4 text-purple-400" />
              <span>Elevated Push-In (No Cuts)</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Camera maintains an elevated telephoto viewpoint with only an ultra-subtle 4.5% cinematic push-in over 15 seconds. No jarring scene transitions.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
              <Film className="w-4 h-4 text-rose-400" />
              <span>Living City Continuation</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              The 15-second sequence finishes with the city continuing to breathe and flow, ready for seamless looping or cinematic broadcast.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
