import React from 'react';
import { Film, Play, Download, Clock, Sparkles } from 'lucide-react';
import { VideoHistoryItem } from '../types';

interface HistoryGalleryProps {
  history: VideoHistoryItem[];
  onSelectVideo: (item: VideoHistoryItem) => void;
}

export const HistoryGallery: React.FC<HistoryGalleryProps> = ({
  history,
  onSelectVideo,
}) => {
  if (history.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center flex flex-col items-center justify-center gap-3">
        <Film className="w-10 h-10 text-neutral-600" />
        <p className="text-sm text-neutral-300 font-medium">No Veo Generations Yet</p>
        <p className="text-xs text-neutral-500 max-w-md">
          Generate your first 15-second living video above using Veo 3.1. All generated videos will appear here for instant replay and MP4 download.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-neutral-200 font-cinzel flex items-center gap-2">
          <Film className="w-4 h-4 text-amber-400" />
          <span>Generation Reel & History</span>
        </h3>
        <span className="text-xs text-neutral-500 font-mono">
          {history.length} video{history.length > 1 ? 's' : ''} saved
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {history.map((item) => (
          <div
            key={item.id}
            className="group relative rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 overflow-hidden transition-all shadow-lg flex flex-col"
          >
            {/* Thumbnail */}
            <div className="relative aspect-[9/16] max-h-60 bg-black overflow-hidden flex items-center justify-center">
              <img
                src={item.thumbnailUrl}
                alt="Thumbnail"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <button
                  onClick={() => onSelectVideo(item)}
                  className="p-3 rounded-full bg-amber-500 text-neutral-950 shadow-xl opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>
              </div>

              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none text-[10px] font-mono text-neutral-300">
                <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md border border-neutral-800">
                  {item.aspectRatio}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 backdrop-blur-md border border-amber-500/30">
                  15.0s
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-3 flex flex-col gap-2 flex-1 justify-between bg-neutral-950/60">
              <p className="text-[11px] text-neutral-300 line-clamp-2 leading-relaxed">
                {item.prompt}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-[10px] text-neutral-500">
                <span>{item.model.split('-')[0].toUpperCase()} 3.1</span>
                <a
                  href={item.videoUrl}
                  download="living_edinburgh.mp4"
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                >
                  <Download className="w-3 h-3" />
                  Save
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
