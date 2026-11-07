import React, { useState } from 'react';
import {
  Sparkles,
  Volume2,
  VolumeX,
  Pause,
  Zap,
  Radio,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Gem,
  Trophy,
  Waves,
  CalendarCheck,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { RiverChapterInfo } from '../game/worldGen';
import { TreasureCounts, StreamDepthInfo } from '../game/engine';
import { DailyMissionsState } from '../game/dailyMissions';

interface GameHUDProps {
  tummy: number;
  counts: TreasureCounts;
  distance: number;
  totalDistance: number;
  progressPercent: number;
  streamDepth: StreamDepthInfo;
  chapter: RiverChapterInfo;
  elapsedSeconds: number;
  tipMessage: string | null;
  treasurePopup: { label: string; points: number; icon: string } | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onTriggerSonar: () => void;
  onSetBoost: (boosting: boolean) => void;
  onVirtualSteer: (x: number, y: number) => void;
  user: User | null;
  onOpenPointTracker: () => void;
  dailyMissions: DailyMissionsState;
  onOpenDailyMissions: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  tummy,
  counts,
  progressPercent,
  streamDepth,
  chapter,
  elapsedSeconds,
  tipMessage,
  treasurePopup,
  isMuted,
  onToggleMute,
  onPause,
  onTriggerSonar,
  onSetBoost,
  onVirtualSteer,
  user,
  onOpenPointTracker,
  dailyMissions,
  onOpenDailyMissions,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isMissionsExpanded, setIsMissionsExpanded] = useState(true);
  const [touchActive, setTouchActive] = useState(false);
  const [activeDir, setActiveDir] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dpadRef = React.useRef<HTMLDivElement>(null);

  const completedMissionsCount = dailyMissions.missions.filter((m) => m.completed).length;
  const totalMissionsCount = dailyMissions.missions.length;

  const updateSteer = (x: number, y: number) => {
    setActiveDir({ x, y });
    onVirtualSteer(x, y);
  };

  const toggleTouchActive = () => {
    if (touchActive) {
      updateSteer(0, 0);
    }
    setTouchActive(!touchActive);
  };

  const handleDpadTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dpadRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = dpadRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = (touch.clientX - centerX) / (rect.width / 2);
    const dy = (touch.clientY - centerY) / (rect.height / 2);

    const deadzone = 0.25;
    const sx = Math.abs(dx) > deadzone ? (dx > 0 ? 1 : -1) : 0;
    // In screen coordinates: negative dy is UP, positive dy is DOWN
    // In engine: positive Y is RISE, negative Y is DIVE
    const sy = Math.abs(dy) > deadzone ? (-dy > 0 ? 1 : -1) : 0;

    updateSteer(sx, sy);
  };

  const handleDpadTouchEnd = () => {
    updateSteer(0, 0);
  };

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  let tummyStatus = 'Energized & Speedy!';
  let tummyColor = 'bg-emerald-500';
  if (tummy === 0) {
    tummyStatus = 'Empty — Swim Slower (Eat Snacks!)';
    tummyColor = 'bg-rose-500';
  } else if (tummy < 25) {
    tummyStatus = 'Hungry — Find Larvae or Tiny Fish!';
    tummyColor = 'bg-red-500';
  } else if (tummy < 65) {
    tummyStatus = 'Swimming Uses Energy';
    tummyColor = 'bg-amber-500';
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 sm:p-5 select-none">
      {/* TOP BAR / PERIMETER CLUSTERS */}
      <div className="flex flex-wrap items-start justify-between gap-2 w-full">
        {/* Top-Left: Hunger Bar + Compact Daily Missions Tracker */}
        <div className="flex flex-col gap-2">
          <div className="pointer-events-auto flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950/85 border border-slate-800 shadow-xl">
            <div className="relative w-10 h-10 rounded-xl bg-orange-950/80 border border-orange-500/40 flex items-center justify-center">
              <span className="text-xl" role="img" aria-label="larva">
                🐛
              </span>
              {tummy < 25 && (
                <span className="absolute -top-1 -right-1 text-[10px] bg-red-600 text-white font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  !
                </span>
              )}
            </div>

            <div className="flex flex-col min-w-[135px] md:min-w-[160px]">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-100">Hunger Bar</span>
                <span className="text-[11px] font-bold tabular-nums text-emerald-300">
                  {tummy}%
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${tummyColor}`}
                  style={{ width: `${tummy}%` }}
                />
              </div>

              <span className="text-[10px] text-slate-400 mt-0.5 font-medium truncate">
                {tummyStatus}
              </span>
            </div>
          </div>

          {/* Compact Collapsible Daily Missions Widget */}
          <div className="pointer-events-auto w-full max-w-[240px] sm:max-w-[260px] rounded-2xl bg-slate-950/85 border border-amber-500/35 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/80">
              <button
                type="button"
                onClick={onOpenDailyMissions}
                className="flex items-center gap-1.5 text-left hover:text-amber-200 transition cursor-pointer"
                title="View Daily Missions & Rewards"
              >
                <CalendarCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] font-extrabold text-amber-200 tracking-wide">
                  Daily Missions
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-black tabular-nums">
                  {completedMissionsCount}/{totalMissionsCount}
                </span>
                {dailyMissions.streakDays > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-400 tabular-nums">
                    <Flame className="w-3 h-3 fill-orange-400 text-orange-400" />
                    {dailyMissions.streakDays}d
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsMissionsExpanded(!isMissionsExpanded)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title={isMissionsExpanded ? 'Collapse Daily Missions' : 'Expand Daily Missions'}
              >
                {isMissionsExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {isMissionsExpanded && (
              <div
                onClick={onOpenDailyMissions}
                className="p-2 space-y-1.5 cursor-pointer hover:bg-slate-900/50 transition"
                title="Click to open Daily Missions details"
              >
                {dailyMissions.missions.map((m) => {
                  const pct = Math.min(100, Math.round((m.current / m.target) * 100));
                  return (
                    <div
                      key={m.id}
                      className={`px-2 py-1 rounded-xl border text-[11px] transition ${
                        m.completed
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                          : 'bg-slate-900/70 border-slate-800/90 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs shrink-0">{m.icon}</span>
                          <span
                            className={`font-bold truncate ${
                              m.completed ? 'line-through text-emerald-300/90' : 'text-slate-100'
                            }`}
                          >
                            {m.title}
                          </span>
                        </div>
                        {m.completed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <span className="text-[10px] font-bold text-amber-300 tabular-nums shrink-0">
                            {m.current}/{m.target}
                          </span>
                        )}
                      </div>
                      {!m.completed && (
                        <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden mt-1">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-teal-400 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {dailyMissions.allCompletedBonusClaimed && (
                  <div className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[10px] font-extrabold text-center">
                    🎉 All Daily Tasks Complete! Tap for Bonus Set
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top-Center: Current River Chapter, Stream Morphology & Live Depth Readout */}
        <div className="hidden lg:flex flex-col items-center">
          <div className="pointer-events-auto px-4 py-1.5 rounded-2xl bg-slate-950/85 border border-teal-500/40 shadow-xl text-center">
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-teal-300 uppercase tracking-wider">
              <span>
                Chapter {chapter.id}: {chapter.name}
              </span>
              <span>·</span>
              <span className="text-emerald-300">{progressPercent}% to Lake</span>
            </div>
            <div className="w-52 h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1 mx-auto">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-sky-200/90 mt-1 font-medium tabular-nums">
              <Waves className="w-3 h-3 text-sky-400" />
              <span>{streamDepth.featureLabel}</span>
              <span className="text-slate-600">·</span>
              <span>
                Dive: {streamDepth.playerDepthMeters}m / Bed: {streamDepth.bedDepthMeters}m
              </span>
            </div>
          </div>
        </div>

        {/* Top-Right: Shiny Treasures Counter, Stars, Total Score & Gmail Tracker Button */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={onOpenDailyMissions}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-950/85 hover:bg-slate-900 border border-emerald-500/40 shadow-xl transition cursor-pointer text-left"
            title="Open Daily Missions"
          >
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] text-emerald-200/80 font-bold uppercase leading-none">
                Tasks
              </div>
              <div className="text-sm font-black text-emerald-300 tabular-nums leading-tight">
                {completedMissionsCount}/{totalMissionsCount}
              </div>
            </div>
          </button>

          <button
            onClick={onOpenPointTracker}
            className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-slate-950/85 hover:bg-slate-900 border border-amber-500/40 shadow-xl transition cursor-pointer text-left"
            title="Open Gmail Point & Treasure Log"
          >
            <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800">
              <Trophy className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-[10px] text-amber-200/80 font-bold uppercase leading-none">
                  Points {user ? '☁️' : ''}
                </div>
                <div className="text-sm font-black text-amber-300 tabular-nums leading-tight">
                  {counts.totalPoints.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800">
              <Gem className="w-4 h-4 text-teal-400" />
              <div>
                <div className="text-[10px] text-teal-200/80 font-bold uppercase leading-none">
                  Treasures
                </div>
                <div className="text-sm font-black text-teal-300 tabular-nums leading-tight flex items-center gap-1">
                  <span>{counts.treasuresTotal}</span>
                  <span className="hidden sm:inline text-[10px] text-slate-400 font-normal">
                    (🪨{counts.smoothStones} ✨{counts.shimmeringScales} 🧭{counts.lostTrinkets} 🦪
                    {counts.riverPearls})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <div>
                <div className="text-[10px] text-yellow-200/80 font-bold uppercase leading-none">
                  Stars
                </div>
                <div className="text-sm font-black text-yellow-300 tabular-nums leading-tight">
                  {counts.stars}
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={onPause}
            className="p-2.5 rounded-2xl bg-slate-950/85 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-900 transition active:scale-95 shadow-xl cursor-pointer"
            title="Pause Game (Esc)"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FLOATING POPUP FOR COLLECTED TREASURES & SNACKS */}
      <div className="w-full flex flex-col items-center gap-1.5 mt-1 pointer-events-none">
        {treasurePopup && (
          <div className="px-4 py-1.5 rounded-full bg-slate-950/90 border border-amber-400/60 text-amber-200 text-xs font-extrabold shadow-2xl flex items-center gap-2">
            <span className="text-base">{treasurePopup.icon}</span>
            <span>{treasurePopup.label}</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-300 tabular-nums">
              +{treasurePopup.points} pts
            </span>
          </div>
        )}

        {tipMessage && (
          <div className="max-w-md px-4 py-1.5 rounded-2xl bg-teal-950/90 border border-teal-400/50 text-teal-100 text-xs font-medium text-center shadow-2xl flex items-center gap-2">
            <span className="text-sm">💡</span>
            <span>{tipMessage}</span>
          </div>
        )}
      </div>

      {/* BOTTOM: UNIFIED CONTROL DOCK & SIDE-BY-SIDE D-PAD */}
      <div className="w-full flex flex-col items-center mt-auto">
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="pointer-events-auto mb-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 shadow-lg cursor-pointer"
        >
          {isDockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Controls ({timeFormatted})</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls ({timeFormatted})</span>
            </>
          )}
        </button>

        {!isDockCollapsed && (
          <div className="w-full flex items-end justify-between sm:justify-center gap-2 sm:gap-3 pointer-events-none">
            {/* Action Bar (Left / Center) */}
            <div
              className={`pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-2xl transition-all ${
                touchActive ? 'flex-1 max-w-md sm:max-w-lg justify-between' : 'max-w-2xl w-full justify-between'
              }`}
            >
              <button
                type="button"
                onClick={onTriggerSonar}
                className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 sm:px-3 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/40 text-amber-200 font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer shadow-md min-w-0"
                title="Activate Barbel Sense (E)"
              >
                <Radio className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">
                  <span className="sm:hidden">Sniff</span>
                  <span className="hidden sm:inline">Sniff (E)</span>
                </span>
              </button>

              <button
                type="button"
                onMouseDown={() => onSetBoost(true)}
                onMouseUp={() => onSetBoost(false)}
                onMouseLeave={() => onSetBoost(false)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  onSetBoost(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onSetBoost(false);
                }}
                onTouchCancel={() => onSetBoost(false)}
                className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 sm:px-3 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 border border-orange-400 text-white font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer shadow-md min-w-0"
                title="Hold Space or Touch to Tail Boost"
              >
                <Zap className="w-4 h-4 fill-white shrink-0" />
                <span className="truncate">
                  <span className="sm:hidden">Boost</span>
                  <span className="hidden sm:inline">Tail Boost (Space)</span>
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenPointTracker}
                className="px-2.5 sm:px-3 py-2 rounded-xl bg-teal-950 hover:bg-teal-900 border border-teal-500/40 text-teal-200 font-bold text-xs transition cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0"
                title="Open Gmail Point & Treasure Tracker"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Gmail Points</span>
              </button>

              <button
                type="button"
                onClick={onToggleMute}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition cursor-pointer shrink-0"
                title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleTouchActive}
                className={`p-2 rounded-xl border transition text-xs font-semibold cursor-pointer shrink-0 flex items-center gap-1 ${
                  touchActive
                    ? 'bg-teal-900 border-teal-400 text-teal-200 shadow-md shadow-teal-900/50'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
                title="Toggle On-Screen Steering Pad"
              >
                <span className="font-bold">D-Pad</span>
              </button>
            </div>

            {/* D-Pad on the Right: docked to the screen bottom side-by-side with the bar */}
            {touchActive && (
              <div
                ref={dpadRef}
                onTouchStart={handleDpadTouchMove}
                onTouchMove={handleDpadTouchMove}
                onTouchEnd={handleDpadTouchEnd}
                onTouchCancel={handleDpadTouchEnd}
                className="pointer-events-auto shrink-0 select-none touch-none"
              >
                <div className="grid grid-cols-3 gap-1 p-1.5 sm:p-2 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-2xl">
                  <div />
                  <button
                    type="button"
                    onMouseDown={() => updateSteer(0, 1)}
                    onMouseUp={() => updateSteer(0, 0)}
                    onMouseLeave={() => updateSteer(0, 0)}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition shadow cursor-pointer ${
                      activeDir.y > 0
                        ? 'bg-teal-500 text-white shadow-teal-500/50 scale-95'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title="Swim Up"
                    aria-label="Swim Up"
                  >
                    <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <div />

                  <button
                    type="button"
                    onMouseDown={() => updateSteer(-1, 0)}
                    onMouseUp={() => updateSteer(0, 0)}
                    onMouseLeave={() => updateSteer(0, 0)}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition shadow cursor-pointer ${
                      activeDir.x < 0
                        ? 'bg-teal-500 text-white shadow-teal-500/50 scale-95'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title="Steer Left"
                    aria-label="Steer Left"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 flex flex-col items-center justify-center text-[8px] sm:text-[9px] text-teal-400 font-extrabold tracking-tight">
                    <span>STEER</span>
                  </div>
                  <button
                    type="button"
                    onMouseDown={() => updateSteer(1, 0)}
                    onMouseUp={() => updateSteer(0, 0)}
                    onMouseLeave={() => updateSteer(0, 0)}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition shadow cursor-pointer ${
                      activeDir.x > 0
                        ? 'bg-teal-500 text-white shadow-teal-500/50 scale-95'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title="Steer Right"
                    aria-label="Steer Right"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  <div />
                  <button
                    type="button"
                    onMouseDown={() => updateSteer(0, -1)}
                    onMouseUp={() => updateSteer(0, 0)}
                    onMouseLeave={() => updateSteer(0, 0)}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition shadow cursor-pointer ${
                      activeDir.y < 0
                        ? 'bg-teal-500 text-white shadow-teal-500/50 scale-95'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title="Dive Down"
                    aria-label="Dive Down"
                  >
                    <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <div />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
