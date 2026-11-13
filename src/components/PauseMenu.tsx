import React from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Settings } from 'lucide-react';
import { PlacePicker } from './TitleScreen';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onSelectChapter: (idx: number) => void;
  currentChapterId: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenGrownUps: () => void;
  onOpenShop: () => void;
  /** The storybook of this swim so far. */
  onOpenStory: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onRestart,
  onSelectChapter,
  currentChapterId,
  isMuted,
  onToggleMute,
  onOpenGrownUps,
  onOpenShop,
  onOpenStory,
}) => {
  const smallBtn =
    'flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition active:scale-95 cursor-pointer';

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/70 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-white">
        <h2 className="text-2xl font-black text-center">Paused</h2>

        <button
          onClick={onResume}
          className="w-full py-4 rounded-3xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-4 border-white/80 text-white text-2xl font-black flex items-center justify-center gap-2 shadow-xl transition active:scale-95 cursor-pointer"
        >
          <Play className="w-7 h-7 fill-white" />
          <span>Keep swimming</span>
        </button>

        <button
          onClick={onOpenShop}
          className="w-full py-3 rounded-2xl bg-pink-500 hover:bg-pink-400 border-2 border-white/40 text-white text-lg font-black flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <span>👒</span>
          <span>Dress up Whiskers</span>
        </button>

        <button
          onClick={onOpenStory}
          className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 border-2 border-white/40 text-amber-950 text-lg font-black flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <span>📚</span>
          <span>Storybook</span>
        </button>

        <div>
          <div className="text-sm font-bold text-teal-200 mb-2 text-center">🗺️ Go somewhere else</div>
          <PlacePicker onPick={onSelectChapter} currentChapterId={currentChapterId} />
        </div>

        <div className="flex gap-2">
          <button onClick={onRestart} className={smallBtn}>
            <RotateCcw className="w-5 h-5" />
            <span>Start over</span>
          </button>
          <button
            onClick={onToggleMute}
            className={smallBtn}
            aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-rose-300" />
            ) : (
              <Volume2 className="w-5 h-5 text-emerald-300" />
            )}
            <span>{isMuted ? 'Sound off' : 'Sound on'}</span>
          </button>
          <button onClick={onOpenGrownUps} className={`${smallBtn} text-white/80`}>
            <Settings className="w-5 h-5" />
            <span>Grown-ups</span>
          </button>
        </div>
      </div>
    </div>
  );
};
