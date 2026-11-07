import React from 'react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Compass,
  Trophy,
  X,
  CalendarCheck,
  Flame,
} from 'lucide-react';
import { CHAPTERS } from '../game/worldGen';
import { PaceMode, TreasureCounts } from '../game/engine';
import { DailyMissionsState } from '../game/dailyMissions';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onSelectChapter: (idx: number) => void;
  currentChapterId: number;
  isMuted: boolean;
  onToggleMute: () => void;
  paceMode: PaceMode;
  onChangePace: (pace: PaceMode) => void;
  counts: TreasureCounts;
  tummy: number;
  onOpenPointTracker: () => void;
  dailyMissions: DailyMissionsState;
  onOpenDailyMissions: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onRestart,
  onSelectChapter,
  currentChapterId,
  isMuted,
  onToggleMute,
  paceMode,
  onChangePace,
  counts,
  tummy,
  onOpenPointTracker,
  dailyMissions,
  onOpenDailyMissions,
}) => {
  const completedMissionsCount = dailyMissions.missions.filter((m) => m.completed).length;
  const totalMissionsCount = dailyMissions.missions.length;

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-none flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-black tracking-wide text-white">River Journey Paused</h2>
            <p className="text-xs text-slate-400">
              Catch your breath while Whiskers rests in the sunlit current!
            </p>
          </div>
          <button
            onClick={onResume}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Status Pills */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
            <span className="text-xl">🐛</span>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Hunger</div>
              <div className="text-sm font-bold text-emerald-400">{tummy}% Full</div>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
            <span className="text-xl">💎</span>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Treasures</div>
              <div className="text-sm font-bold text-teal-300">{counts.treasuresTotal} Found</div>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Score</div>
              <div className="text-sm font-bold text-amber-300">
                {counts.totalPoints.toLocaleString()} pts
              </div>
            </div>
          </div>
        </div>

        {/* Daily Missions & Gmail Point Tracker Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          <button
            onClick={onOpenDailyMissions}
            className="py-2.5 px-3.5 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              Daily Missions ({completedMissionsCount}/{totalMissionsCount})
            </span>
            {dailyMissions.streakDays > 0 && (
              <span className="flex items-center gap-0.5 text-orange-300 shrink-0">
                <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                {dailyMissions.streakDays}d
              </span>
            )}
          </button>

          <button
            onClick={onOpenPointTracker}
            className="py-2.5 px-3.5 rounded-2xl bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">Gmail Log ({counts.stars} ⭐ Stars)</span>
          </button>
        </div>

        {/* Journey Pacing Setting */}
        <div className="mb-4 p-3 rounded-2xl bg-slate-950/40 border border-slate-800">
          <div className="text-xs font-semibold text-slate-300 mb-2">Journey Pacing</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChangePace('epic')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                paceMode === 'epic'
                  ? 'bg-orange-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              30-Min Grand Expedition
            </button>
            <button
              onClick={() => onChangePace('cozy')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                paceMode === 'cozy'
                  ? 'bg-orange-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              10-Min Quick Splash
            </button>
          </div>
        </div>

        {/* Chapter Fast-Travel / Select */}
        <div className="mb-5">
          <div className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>River Reaches</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CHAPTERS.map((ch, idx) => (
              <button
                key={ch.id}
                onClick={() => onSelectChapter(idx)}
                className={`p-2.5 rounded-xl text-left text-xs border transition cursor-pointer ${
                  currentChapterId === ch.id
                    ? 'bg-teal-950/80 border-teal-500/80 text-white font-bold'
                    : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold truncate">
                  {ch.id}. {ch.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{ch.subtitle}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={onResume}
            className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>Resume Swimming</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onRestart}
              className="flex-1 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart River From Start</span>
            </button>

            <button
              onClick={onToggleMute}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Toggle Audio"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
