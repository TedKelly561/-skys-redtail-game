import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { TreasureCounts } from '../game/engine';

interface GrandLakeVictoryProps {
  counts: TreasureCounts;
  playerName: string;
  onFreeSwim: () => void;
  onRestart: () => void;
  /** Show the panel right away (the storybook was just read). */
  instant?: boolean;
  /** Open the storybook of this trip. */
  onOpenStory?: () => void;
}

export const GrandLakeVictory: React.FC<GrandLakeVictoryProps> = ({
  counts,
  playerName,
  onFreeSwim,
  onRestart,
  instant = false,
  onOpenStory,
}) => {
  // Let the celebration (family, rainbow, sparkles) play for a moment before the panel.
  const [showPanel, setShowPanel] = useState(instant);
  useEffect(() => {
    if (instant) return;
    const t = window.setTimeout(() => setShowPanel(true), 2600);
    return () => window.clearTimeout(t);
  }, []);
  if (!showPanel) return null;

  return (
    <div className="absolute inset-0 z-40 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent flex items-end sm:items-center justify-center p-4 pb-6 select-none">
      <div className="animate-pop w-full max-w-sm bg-gradient-to-b from-sky-900 to-slate-950 border-4 border-amber-300 rounded-[2rem] p-6 shadow-2xl flex flex-col items-center text-center text-white">
        <div className="text-6xl leading-none mb-2" aria-hidden="true">
          🏝️
        </div>
        <h2 className="text-3xl font-black text-amber-200 drop-shadow">You made it home!</h2>

        <p className="mt-3 mb-4 px-4 py-3 rounded-2xl bg-white/10 text-base font-semibold leading-snug">
          🐟 “Welcome home, Whiskers!{' '}
          {playerName ? `Thank you for helping, ${playerName}!` : 'Look at all your treasures!'}”
        </p>

        <div className="flex items-center justify-center gap-6 mb-5 text-4xl font-black tabular-nums">
          <span>⭐ {counts.stars}</span>
          <span>💎 {counts.treasuresTotal}</span>
        </div>

        <button
          onClick={onFreeSwim}
          className="w-full py-4 rounded-3xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-4 border-white/80 text-white text-xl font-black shadow-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <span className="text-2xl">🐟</span>
          <span>Swim with family</span>
        </button>

        {onOpenStory && (
          <button
            onClick={onOpenStory}
            className="mt-3 w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 text-base font-black flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <span className="text-xl">📚</span>
            <span>Our storybook</span>
          </button>
        )}

        <button
          onClick={onRestart}
          className="mt-3 w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-base font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Play again</span>
        </button>
      </div>
    </div>
  );
};
