import React, { useMemo, useRef, useState } from 'react';
import { Pause, Zap } from 'lucide-react';
import { RiverChapterInfo } from '../game/worldGen';
import { MiniGameInfo, TreasureCounts } from '../game/engine';
import { DailyMissionsState } from '../game/dailyMissions';

export interface TreasurePopupInfo {
  id: number;
  label: string;
  points: number;
  icon: string;
}

interface GameHUDProps {
  tummy: number;
  counts: TreasureCounts;
  progressPercent: number;
  chapter: RiverChapterInfo;
  elapsedSeconds: number;
  tipMessage: string | null;
  treasurePopup: TreasurePopupInfo | null;
  sniffReady: boolean;
  onPause: () => void;
  onTakePhoto: () => void;
  onTriggerSonar: () => void;
  onSetBoost: (boosting: boolean) => void;
  onVirtualSteer: (x: number, y: number) => void;
  dailyMissions: DailyMissionsState;
  onOpenDailyMissions: () => void;
  friendsMet: number;
  friendsTotal: number;
  /** A friend not met yet is close enough to sniff. */
  friendNearby: boolean;
  onOpenFriends: () => void;
  miniGame: MiniGameInfo;
  onStartHideSeek: () => void;
}

/** True on phones and tablets (any coarse pointer), so we show the thumb joystick. */
export function useIsTouchDevice(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(any-pointer: coarse)').matches === true ||
      (navigator.maxTouchPoints ?? 0) > 0
    );
  }, []);
}

const panel = 'bg-slate-950/80 border border-white/10 shadow-xl backdrop-blur-sm';

/** Thumb joystick: drag the knob to steer left/right and swim up/down. */
const Joystick: React.FC<{ onSteer: (x: number, y: number) => void }> = ({ onSteer }) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const moveTo = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const r = rect.width / 2;
    let dx = (clientX - (rect.left + r)) / r;
    let dy = (clientY - (rect.top + r)) / r;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    setKnob({ x: dx, y: dy });
    const dead = 0.18;
    // Screen down is +y, but in the game +y means swim up.
    onSteer(Math.abs(dx) > dead ? dx : 0, Math.abs(dy) > dead ? -dy : 0);
  };

  const release = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
    setKnob({ x: 0, y: 0 });
    onSteer(0, 0);
  };

  return (
    <div
      ref={baseRef}
      className="pointer-events-auto touch-none no-callout relative w-32 h-32 rounded-full bg-slate-950/45 border-4 border-white/25 shadow-xl"
      onPointerDown={(e) => {
        if (activePointer.current !== null) return;
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.pointerId === activePointer.current) moveTo(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Swim joystick"
    >
      <div
        className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 border-4 border-white/80 shadow-lg flex items-center justify-center text-2xl"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${knob.x * 36}px), calc(-50% + ${knob.y * 36}px))`,
        }}
      >
        🐟
      </div>
    </div>
  );
};

export const GameHUD: React.FC<GameHUDProps> = ({
  tummy,
  counts,
  progressPercent,
  chapter,
  elapsedSeconds,
  tipMessage,
  treasurePopup,
  sniffReady,
  onPause,
  onTakePhoto,
  onTriggerSonar,
  onSetBoost,
  onVirtualSteer,
  dailyMissions,
  onOpenDailyMissions,
  friendsMet,
  friendsTotal,
  friendNearby,
  onOpenFriends,
  miniGame,
  onStartHideSeek,
}) => {
  const isTouch = useIsTouchDevice();
  const sniffUsable = sniffReady || friendNearby;
  const [isBoosting, setIsBoosting] = useState(false);

  const setBoost = (on: boolean) => {
    setIsBoosting(on);
    onSetBoost(on);
  };

  // Tummy face: kids read faces faster than numbers.
  let tummyFace = '😋';
  let tummyColor = 'from-emerald-400 to-lime-300';
  if (tummy < 25) {
    tummyFace = '😣';
    tummyColor = 'from-rose-500 to-orange-400';
  } else if (tummy < 55) {
    tummyFace = '🙂';
    tummyColor = 'from-amber-400 to-yellow-300';
  }

  const nextMission = dailyMissions.missions.find((m) => !m.completed);
  const allMissionsDone = dailyMissions.missions.length > 0 && !nextMission;

  const progressBar = (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full h-4 rounded-full bg-slate-900/80 border-2 border-white/20">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal-400 to-sky-300 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
        <span
          className="absolute top-1/2 text-2xl transition-all duration-500 drop-shadow"
          style={{ left: `${progressPercent}%`, transform: 'translate(-50%, -55%) scaleX(-1)' }}
          aria-hidden="true"
        >
          🐟
        </span>
        <span
          className="absolute top-1/2 -right-3 text-2xl -translate-y-1/2 drop-shadow"
          aria-hidden="true"
        >
          🏝️
        </span>
      </div>
      <div className="mt-1.5 text-[11px] font-bold text-white/90 drop-shadow tracking-wide">
        {chapter.icon} {chapter.name}
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col p-3 sm:p-5 select-none">
      {/* TOP ROW */}
      <div className="flex items-start justify-between gap-3 w-full">
        {/* Tummy + mission */}
        <div className="flex flex-col gap-2">
          <div
            className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full ${panel}`}
            aria-label={`Tummy ${tummy}% full`}
          >
            <span className={`text-3xl leading-none ${tummy < 25 ? 'animate-wiggle' : ''}`}>
              {tummyFace}
            </span>
            <div className="w-20 sm:w-32 h-4 rounded-full bg-slate-800 overflow-hidden border-2 border-white/15">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${tummyColor} transition-all duration-300`}
                style={{ width: `${tummy}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenDailyMissions}
            className={`pointer-events-auto self-start flex items-center gap-2 pl-2 pr-3 py-1 rounded-full ${panel} text-white cursor-pointer active:scale-95 transition`}
            aria-label="Today's missions"
          >
            {allMissionsDone ? (
              <>
                <span className="text-xl">🎁</span>
                <span className="text-sm font-black text-amber-300">All done!</span>
              </>
            ) : nextMission ? (
              <>
                <span className="text-xl">{nextMission.icon}</span>
                <span className="text-sm font-black tabular-nums">
                  {nextMission.current}/{nextMission.target}
                </span>
                <span className="w-10 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <span
                    className="block h-full bg-amber-400 rounded-full"
                    style={{
                      width: `${Math.min(100, (nextMission.current / nextMission.target) * 100)}%`,
                    }}
                  />
                </span>
              </>
            ) : null}
          </button>
        </div>

        {/* Journey progress (wide screens) */}
        <div className="hidden md:block flex-1 max-w-sm pt-2 px-4">{progressBar}</div>

        {/* Stars, treasures, pause; sticker book below */}
        <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full ${panel}`}>
            <span className="flex items-center gap-1 text-white">
              <span className="text-2xl leading-none">⭐</span>
              <span className="text-xl font-black tabular-nums">{counts.stars}</span>
            </span>
            <span className="flex items-center gap-1 text-white">
              <span className="text-2xl leading-none">💎</span>
              <span className="text-xl font-black tabular-nums">{counts.treasuresTotal}</span>
            </span>
          </div>
          <button
            onClick={onPause}
            className={`pointer-events-auto w-12 h-12 rounded-full ${panel} text-white flex items-center justify-center active:scale-90 transition cursor-pointer`}
            aria-label="Pause"
            title="Pause (Esc)"
          >
            <Pause className="w-6 h-6 fill-white" />
          </button>
        </div>
          <button
            type="button"
            onClick={onOpenFriends}
            className={`pointer-events-auto flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full ${panel} text-white cursor-pointer active:scale-95 transition`}
            aria-label="Friends sticker book"
          >
            <span className="text-xl">📖</span>
            <span className="text-sm font-black tabular-nums">
              {friendsMet}/{friendsTotal}
            </span>
          </button>
          <button
            type="button"
            onClick={onTakePhoto}
            className={`pointer-events-auto w-11 h-11 rounded-full ${panel} text-white flex items-center justify-center text-xl active:scale-90 transition cursor-pointer`}
            aria-label="Take a photo"
          >
            📷
          </button>
          {miniGame.pearls && (
            <div
              className={`flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full ${panel} text-white`}
              aria-label={`Pearls found today: ${miniGame.pearls.found} of ${miniGame.pearls.total}`}
            >
              <span className="text-xl">🦪</span>
              <span className="text-sm font-black tabular-nums">
                {miniGame.pearls.found}/{miniGame.pearls.total}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Journey progress (phones / small tablets) */}
      <div className="md:hidden w-full max-w-xs mx-auto mt-2 px-4">{progressBar}</div>

      {/* Dolphin race: both racers heading for the checkered flag */}
      {miniGame.race && (
        <div className={`mt-2 mx-auto w-full max-w-sm px-3 py-2 rounded-2xl ${panel}`}>
          <div className="relative h-14">
            {[
              { icon: '🐟', p: miniGame.race.whiskers, top: 'top-0', label: 'You' },
              // The dolphin race shows the dolphin; a ghost race shows the ghost (or nobody, the first time).
              ...(miniGame.race.rivalIcon !== 'none'
                ? [{ icon: miniGame.race.rivalIcon || '🐬', p: miniGame.race.dolphin, top: 'top-7', label: miniGame.race.rivalLabel || '' }]
                : []),
            ].map((r) => (
              <div key={r.icon} className={`absolute inset-x-0 ${r.top} h-6`}>
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/20" />
                <span
                  className="absolute top-1/2 text-2xl transition-all duration-150"
                  style={{ left: `${r.p * 92}%`, transform: 'translateY(-50%) scaleX(-1)' }}
                >
                  {r.icon}
                </span>
              </div>
            ))}
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-3xl">🏁</span>
          </div>
        </div>
      )}

      {/* Short tip under the top bar */}
      <div className="w-full flex justify-center mt-3 min-h-[2.5rem]">
        {tipMessage && (
          <div
            key={tipMessage}
            className={`animate-pop max-w-xs sm:max-w-md px-4 py-2 rounded-2xl ${panel} text-white text-base sm:text-lg font-bold text-center`}
          >
            {tipMessage}
          </div>
        )}
      </div>

      {/* Big friendly pickup popup */}
      <div className="w-full flex justify-center mt-2">
        {treasurePopup && (
          <div key={treasurePopup.id} className="animate-pop flex flex-col items-center">
            <span className="text-6xl drop-shadow-lg leading-none">{treasurePopup.icon}</span>
            <span className="mt-1 text-2xl sm:text-3xl font-black text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">
              {treasurePopup.label}
            </span>
            {treasurePopup.points > 0 && (
              <span className="text-base font-black text-amber-300 drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]">
                +{treasurePopup.points}
              </span>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="mt-auto w-full flex items-end justify-between gap-3">
        {isTouch ? (
          <Joystick onSteer={onVirtualSteer} />
        ) : (
          <div
            className={`px-3 py-2 rounded-2xl ${panel} text-white/90 text-sm font-semibold transition-opacity duration-700 ${
              elapsedSeconds < 20 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            ⬅️ ➡️ ⬆️ ⬇️ to swim
          </div>
        )}

        <div className="flex items-end gap-3">
          {(miniGame.canHideSeek || miniGame.hideSeekActive) && (
            <button
              type="button"
              onClick={onStartHideSeek}
              disabled={miniGame.hideSeekActive}
              className={`pointer-events-auto no-callout self-center px-3 py-2 rounded-2xl border-4 text-sm font-black shadow-xl transition active:scale-95 cursor-pointer ${
                miniGame.hideSeekActive
                  ? 'bg-sky-100 border-sky-300 text-sky-800'
                  : 'bg-gradient-to-b from-sky-300 to-sky-500 border-white/80 text-white animate-pulse'
              }`}
              aria-label={miniGame.hideSeekActive ? 'Find Pip' : 'Play hide and seek'}
            >
              <span className="text-xl mr-1">{miniGame.hideSeekActive ? '🔍' : '🙈'}</span>
              {miniGame.hideSeekActive ? 'Find Pip!' : 'Hide & seek'}
            </button>
          )}
          <button
            type="button"
            onPointerDown={() => onTriggerSonar()}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!sniffUsable}
            className={`relative pointer-events-auto no-callout touch-none w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full border-4 flex flex-col items-center justify-center shadow-xl transition active:scale-90 cursor-pointer ${
              sniffUsable
                ? 'bg-amber-400 border-white/80 text-slate-900'
                : 'bg-slate-700/80 border-white/20 text-white/50 cursor-default'
            } ${friendNearby ? 'ring-4 ring-pink-300 animate-pulse' : ''}`}
            aria-label={friendNearby ? 'Sniff to say hi to a new friend' : 'Sniff for snacks'}
            title="Sniff for snacks and friends (E)"
          >
            {friendNearby && (
              <span className="absolute -top-3 -right-2 text-2xl animate-wiggle" aria-hidden="true">
                👋
              </span>
            )}
            <span className="text-2xl leading-none">👃</span>
            <span className="text-[10px] font-black uppercase mt-0.5">
              {isTouch ? 'Sniff' : 'Sniff · E'}
            </span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setBoost(true);
            }}
            onPointerUp={() => setBoost(false)}
            onPointerCancel={() => setBoost(false)}
            onLostPointerCapture={() => setBoost(false)}
            onContextMenu={(e) => e.preventDefault()}
            className={`pointer-events-auto no-callout touch-none w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white/80 flex flex-col items-center justify-center shadow-xl transition cursor-pointer ${
              isBoosting
                ? 'bg-orange-600 scale-90'
                : 'bg-gradient-to-br from-orange-400 to-orange-600'
            } text-white`}
            aria-label="Zoom"
            title="Zoom (hold Space)"
          >
            <Zap className="w-8 h-8 fill-white" />
            <span className="text-[11px] font-black uppercase">
              {isTouch ? 'Zoom' : 'Zoom · Space'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
