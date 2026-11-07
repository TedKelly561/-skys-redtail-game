import React from 'react';
import {
  X,
  CheckCircle2,
  Flame,
  Sparkles,
  Gift,
  RefreshCw,
  Calendar,
  Play,
} from 'lucide-react';
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

  const completedCount = dailyMissions.missions.filter((m) => m.completed).length;
  const totalCount = dailyMissions.missions.length;
  const allCompleted = completedCount === totalCount && totalCount > 0;

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 select-none pointer-events-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/90 rounded-3xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Daily River Missions</h2>
              <p className="text-xs text-slate-400">
                Complete easy daily tasks with Whiskers to earn bonus points & build your streak!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="Close Daily Missions"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Streak & Daily Progress Summary Bar */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tabular-nums">
                {dailyMissions.streakDays} {dailyMissions.streakDays === 1 ? 'Day' : 'Days'} Habit Streak
              </div>
              <div className="text-xs text-slate-400">
                Complete at least 1 mission each day to keep your river streak glowing!
              </div>
            </div>
          </div>

          <div className="text-right tabular-nums">
            <div className="text-xs text-slate-400">Today's Tasks</div>
            <div className="text-lg font-black text-emerald-300">
              {completedCount} / {totalCount} Completed
            </div>
          </div>
        </div>

        {/* 3 Daily Mission Cards */}
        <div className="space-y-3 mb-5">
          {dailyMissions.missions.map((mission, idx) => {
            const pct = Math.min(100, Math.round((mission.current / mission.target) * 100));
            return (
              <div
                key={mission.id}
                className={`p-4 rounded-2xl border transition ${
                  mission.completed
                    ? 'bg-emerald-950/40 border-emerald-500/50'
                    : 'bg-slate-950/75 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                      {mission.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          0{idx + 1}. {mission.title}
                        </span>
                        {mission.completed && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{mission.description}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 tabular-nums">
                    <div
                      className={`text-xs font-extrabold ${
                        mission.completed ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      +{mission.rewardPoints} pts
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {mission.completed ? 'Earned!' : `${mission.current} / ${mission.target}`}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      mission.completed
                        ? 'bg-emerald-400'
                        : 'bg-gradient-to-r from-teal-500 to-amber-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* All-Clear Bonus Chest Banner */}
        <div
          className={`p-4 rounded-2xl border mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            dailyMissions.allCompletedBonusClaimed
              ? 'bg-amber-950/50 border-amber-400/60'
              : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-200 flex items-center gap-1.5">
                <span>Daily All-Clear Bonus</span>
                <span className="text-amber-400 font-black tabular-nums">
                  +{dailyMissions.allCompletedBonusPoints} pts
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {dailyMissions.allCompletedBonusClaimed
                  ? 'Awesome job! You completed all 3 tasks and earned the +100 pt bonus!'
                  : 'Complete all 3 daily missions above to automatically unlock +100 extra points!'}
              </div>
            </div>
          </div>

          {allCompleted && (
            <button
              onClick={onStartNextBonusSet}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>New Bonus Tasks</span>
            </button>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 tabular-nums">
            Total Missions Completed: <strong className="text-slate-200">{dailyMissions.totalMissionsCompleted}</strong>
          </div>

          <div className="flex items-center gap-2">
            {isTitleScreen && onStartSwimIfTitle && (
              <button
                onClick={() => {
                  onClose();
                  onStartSwimIfTitle();
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>Swim & Complete Tasks</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
