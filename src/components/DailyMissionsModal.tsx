import React from 'react';
import { X, Play } from 'lucide-react';
import { DailyMissionsState } from '../game/dailyMissions';

interface DailyMissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyMissions: DailyMissionsState;
  onStartNextBonusSet: () => void;
  onStartSwimIfTitle?: () => void;
  isTitleScreen?: boolean;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  isOpen,
  onClose,
  dailyMissions,
  onStartNextBonusSet,
  onStartSwimIfTitle,
  isTitleScreen = false,
}) => {
  if (!isOpen) return null;

  const total = dailyMissions.missions.length;
  const done = dailyMissions.missions.filter((m) => m.completed).length;
  const allDone = total > 0 && done === total;

  return (
    <div
      className="absolute inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 select-none pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-slate-900 border-2 border-white/10 rounded-3xl p-5 shadow-2xl text-white max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black">🎯 Today's missions</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-white/70 hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {dailyMissions.streakDays > 0 && (
          <div className="mb-3 text-center text-base font-bold text-orange-300">
            🔥 {dailyMissions.streakDays} {dailyMissions.streakDays === 1 ? 'day' : 'days'} in a row!
          </div>
        )}

        <div className="space-y-2.5 mb-4">
          {dailyMissions.missions.map((m) => {
            const pct = Math.min(100, Math.round((m.current / m.target) * 100));
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${
                  m.completed ? 'bg-emerald-900/40 border-emerald-400/60' : 'bg-slate-950/60 border-white/10'
                }`}
              >
                <span className="text-4xl leading-none shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold leading-tight">{m.title}</div>
                  <div className="mt-1.5 h-3 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        m.completed ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-lg font-black tabular-nums shrink-0">
                  {m.completed ? '✅' : `${m.current}/${m.target}`}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className={`p-3 rounded-2xl text-center font-bold mb-4 ${
            allDone ? 'bg-amber-400/20 text-amber-200' : 'bg-slate-950/50 text-white/80'
          }`}
        >
          {allDone ? '🎁 You did them all! Great job!' : `🎁 Finish all ${total} for a big bonus!`}
        </div>

        <div className="flex flex-col gap-2">
          {allDone && (
            <button
              onClick={onStartNextBonusSet}
              className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-lg transition active:scale-95 cursor-pointer"
            >
              ✨ More missions
            </button>
          )}
          {isTitleScreen && onStartSwimIfTitle ? (
            <button
              onClick={() => {
                onClose();
                onStartSwimIfTitle();
              }}
              className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Let's swim!</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg transition active:scale-95 cursor-pointer"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
