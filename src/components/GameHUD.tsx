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
  MapPin,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Gem,
  Trophy,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { RiverChapterInfo } from '../game/worldGen';
import { TreasureCounts } from '../game/engine';

interface GameHUDProps {
  tummy: number;
  counts: TreasureCounts;
  distance: number;
  totalDistance: number;
  progressPercent: number;
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
}

export const GameHUD: React.FC<GameHUDProps> = ({
  tummy,
  counts,
  progressPercent,
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
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [touchActive, setTouchActive] = useState(false);

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
        {/* Top-Left: Hunger Bar */}
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

        {/* Top-Center: Current River Chapter & Progress */}
        <div className="hidden lg:flex flex-col items-center">
          <div className="pointer-events-auto px-4 py-1.5 rounded-2xl bg-slate-950/85 border border-teal-500/40 shadow-xl text-center">
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-teal-300 uppercase tracking-wider">
              <span>Chapter {chapter.id}: {chapter.name}</span>
              <span>·</span>
              <span className="text-emerald-300">{progressPercent}% to Lake</span>
            </div>
            <div className="w-44 h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1 mx-auto">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Top-Right: Shiny Treasures Counter, Stars, Total Score & Gmail Tracker Button */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Shiny Treasures & Points Counter Card (Clickable to open Gmail Point Tracker) */}
          <button
            onClick={onOpenPointTracker}
            className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-slate-950/85 hover:bg-slate-900 border border-amber-500/40 shadow-xl transition cursor-pointer text-left"
            title="Open Gmail Point & Treasure Log"
          >
            {/* Score */}
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

            {/* Shiny Treasures Counter */}
            <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800">
              <Gem className="w-4 h-4 text-teal-400" />
              <div>
                <div className="text-[10px] text-teal-200/80 font-bold uppercase leading-none">
                  Treasures
                </div>
                <div className="text-sm font-black text-teal-300 tabular-nums leading-tight flex items-center gap-1">
                  <span>{counts.treasuresTotal}</span>
                  <span className="hidden sm:inline text-[10px] text-slate-400 font-normal">
                    (🪨{counts.smoothStones} ✨{counts.shimmeringScales} 🧭{counts.lostTrinkets} 🦪{counts.riverPearls})
                  </span>
                </div>
              </div>
            </div>

            {/* Golden Stars */}
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

          {/* Quick Pause Button */}
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

      {/* BOTTOM: UNIFIED CONTROL DOCK (Collapsible, Ergonomic) */}
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
          <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-2xl max-w-2xl w-full justify-between">
            {/* Action 1: Barbel Sniffer Pulse */}
            <button
              onClick={onTriggerSonar}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/40 text-amber-200 font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer shadow-md"
              title="Activate Barbel Sense (E)"
            >
              <Radio className="w-4 h-4 text-amber-400" />
              <span>Sniff Treasures (E)</span>
            </button>

            {/* Action 2: Tail Swish Boost */}
            <button
              onMouseDown={() => onSetBoost(true)}
              onMouseUp={() => onSetBoost(false)}
              onTouchStart={() => onSetBoost(true)}
              onTouchEnd={() => onSetBoost(false)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 border border-orange-400 text-white font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer shadow-md"
              title="Hold Space or Touch to Tail Boost"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Tail Boost (Space)</span>
            </button>

            {/* Gmail Point Log Button */}
            <button
              onClick={onOpenPointTracker}
              className="px-3 py-2 rounded-xl bg-teal-950 hover:bg-teal-900 border border-teal-500/40 text-teal-200 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
              title="Open Gmail Point & Treasure Tracker"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Gmail Points</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={onToggleMute}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            {/* Toggle On-Screen Touch D-Pad */}
            <button
              onClick={() => setTouchActive(!touchActive)}
              className={`p-2 rounded-xl border transition text-xs font-semibold cursor-pointer ${
                touchActive
                  ? 'bg-teal-900 border-teal-400 text-teal-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
              title="Toggle On-Screen Steering Pad"
            >
              D-Pad
            </button>
          </div>
        )}

        {/* On-Screen Touch D-Pad (Left = -1, Right = +1, Up = +1, Down = -1) */}
        {touchActive && !isDockCollapsed && (
          <div className="pointer-events-auto mt-2 flex items-center justify-center gap-3">
            <div className="grid grid-cols-3 gap-1 p-2 rounded-2xl bg-slate-950/85 border border-slate-800">
              <div />
              <button
                onMouseDown={() => onVirtualSteer(0, 1)}
                onMouseUp={() => onVirtualSteer(0, 0)}
                onTouchStart={() => onVirtualSteer(0, 1)}
                onTouchEnd={() => onVirtualSteer(0, 0)}
                className="p-3 bg-slate-800 rounded-xl active:bg-teal-600 text-white flex items-center justify-center"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div />

              <button
                onMouseDown={() => onVirtualSteer(-1, 0)}
                onMouseUp={() => onVirtualSteer(0, 0)}
                onTouchStart={() => onVirtualSteer(-1, 0)}
                onTouchEnd={() => onVirtualSteer(0, 0)}
                className="p-3 bg-slate-800 rounded-xl active:bg-teal-600 text-white flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center justify-center text-[10px] text-slate-400 font-bold">
                STEER
              </div>
              <button
                onMouseDown={() => onVirtualSteer(1, 0)}
                onMouseUp={() => onVirtualSteer(0, 0)}
                onTouchStart={() => onVirtualSteer(1, 0)}
                onTouchEnd={() => onVirtualSteer(0, 0)}
                className="p-3 bg-slate-800 rounded-xl active:bg-teal-600 text-white flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div />
              <button
                onMouseDown={() => onVirtualSteer(0, -1)}
                onMouseUp={() => onVirtualSteer(0, 0)}
                onTouchStart={() => onVirtualSteer(0, -1)}
                onTouchEnd={() => onVirtualSteer(0, 0)}
                className="p-3 bg-slate-800 rounded-xl active:bg-teal-600 text-white flex items-center justify-center"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <div />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
