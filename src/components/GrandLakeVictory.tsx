import React from 'react';
import { Sparkles, Trophy, RotateCcw, Heart, Waves, Gem, Mail } from 'lucide-react';
import { TreasureCounts } from '../game/engine';

interface GrandLakeVictoryProps {
  counts: TreasureCounts;
  elapsedSeconds: number;
  onFreeSwim: () => void;
  onRestart: () => void;
  onOpenPointTracker: () => void;
}

export const GrandLakeVictory: React.FC<GrandLakeVictoryProps> = ({
  counts,
  elapsedSeconds,
  onFreeSwim,
  onRestart,
  onOpenPointTracker,
}) => {
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const timeFormatted = `${mins}m ${secs}s`;

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/75 backdrop-blur-none flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400/80 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col text-slate-100 text-center relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/15 rounded-full filter blur-3xl pointer-events-none" />

        <div className="relative mx-auto mb-3 w-16 h-16 rounded-3xl bg-gradient-to-tr from-orange-500 to-amber-400 p-0.5 shadow-lg shadow-orange-500/30 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
            <Heart className="w-8 h-8 text-rose-400 fill-rose-400 animate-bounce" />
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-300 to-amber-100 mb-1">
          The Great Grand Lake!
        </h2>
        <p className="text-teal-300 text-sm font-semibold mb-4">
          Whiskers made it home to the magnificent paradise lake!
        </p>

        <div className="p-4 rounded-2xl bg-teal-950/60 border border-teal-500/40 text-left mb-5 shadow-inner">
          <div className="flex items-center gap-2 mb-1 text-xs font-bold text-amber-300">
            <span>🐟</span>
            <span>Mother Catfish (Mariana):</span>
          </div>
          <p className="text-xs md:text-sm text-slate-200 italic leading-relaxed">
            "Whiskers, you brave little Redtail Catfish! You swam all the way down through the sunlit bends, swirling rapids, and lotus groves. Look at all the shiny smooth stones, shimmering scales, and golden trinkets you discovered!"
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-amber-500/30 flex flex-col items-center">
            <Trophy className="w-5 h-5 text-amber-400 mb-1" />
            <div className="text-xl font-black text-amber-300 tabular-nums">
              {counts.totalPoints.toLocaleString()}
            </div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Total Points</div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/90 border border-teal-500/30 flex flex-col items-center">
            <Gem className="w-5 h-5 text-teal-400 mb-1" />
            <div className="text-xl font-black text-teal-300 tabular-nums">
              {counts.treasuresTotal}
            </div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Treasures</div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/90 border border-yellow-500/30 flex flex-col items-center">
            <Sparkles className="w-5 h-5 text-yellow-400 mb-1" />
            <div className="text-xl font-black text-yellow-300 tabular-nums">{counts.stars}</div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase">
              Stars ({timeFormatted})
            </div>
          </div>
        </div>

        <button
          onClick={onOpenPointTracker}
          className="mb-5 py-2.5 px-4 rounded-2xl bg-amber-950/70 hover:bg-amber-900/80 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Mail className="w-4 h-4 text-amber-400" />
          <span>Save & Email Your Grand Lake Point Certificate via Gmail</span>
        </button>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            onClick={onFreeSwim}
            className="w-full sm:flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base shadow-lg shadow-teal-500/25 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-emerald-300/40"
          >
            <Waves className="w-5 h-5 fill-slate-950" />
            <span>Swim Together in Lake</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Journey Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
