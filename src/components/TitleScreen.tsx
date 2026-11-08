import React, { useState } from 'react';
import { Play, Volume2, VolumeX, Map as MapIcon, Settings, Pencil } from 'lucide-react';
import { CHAPTERS, RiverChapterInfo } from '../game/worldGen';
import { TreasureCounts } from '../game/engine';
import { DailyMissionsState } from '../game/dailyMissions';
import { useIsTouchDevice } from './GameHUD';
import { MAX_NAME_LENGTH } from '../game/profile';

interface TitleScreenProps {
  onStartGame: (chapterIdx: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  counts: TreasureCounts;
  onOpenGrownUps: () => void;
  onOpenShop: () => void;
  isNight: boolean;
  onToggleNight: () => void;
  /** Part of the river saved from last time, if any (shows a Continue button). */
  continueChapter: RiverChapterInfo | null;
  onContinue: () => void;
  dailyMissions: DailyMissionsState;
  onOpenDailyMissions: () => void;
  playerName: string;
  /** First visit on this device: ask for the player's name before showing Play. */
  askForName: boolean;
  onSetName: (name: string) => void;
  friendsMet: number;
  friendsTotal: number;
  onOpenFriends: () => void;
}

/** "What's your name?" card. A grown-up can type it; Skip is always available. */
const NameCard: React.FC<{
  initial: string;
  onDone: (name: string) => void;
}> = ({ initial, onDone }) => {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="pointer-events-auto w-full max-w-xs p-4 rounded-3xl bg-slate-950/85 border-2 border-white/15 shadow-2xl flex flex-col items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(value);
      }}
    >
      <label htmlFor="player-name" className="text-xl font-black text-white">
        👋 What's your name?
      </label>
      <input
        id="player-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="go"
        placeholder="Type your name"
        className="w-full px-4 py-3 rounded-2xl bg-white text-slate-900 text-2xl font-bold text-center outline-none border-4 border-teal-300 focus:border-amber-300 placeholder:text-slate-400 placeholder:text-lg"
      />
      <button
        type="submit"
        className="w-full py-3 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-4 border-white/80 text-white text-xl font-black transition active:scale-95 cursor-pointer"
      >
        That's me!
      </button>
      <button
        type="button"
        onClick={() => onDone('')}
        className="text-sm font-semibold text-white/60 hover:text-white cursor-pointer"
      >
        Skip
      </button>
    </form>
  );
};

/** Five big picture cards so a child can jump to their favorite part of the river. */
export const PlacePicker: React.FC<{
  onPick: (idx: number) => void;
  currentChapterId?: number;
}> = ({ onPick, currentChapterId }) => (
  <div className="grid grid-cols-5 gap-2 w-full">
    {CHAPTERS.map((ch, idx) => (
      <button
        key={ch.id}
        onClick={() => onPick(idx)}
        className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition active:scale-90 cursor-pointer ${
          currentChapterId === ch.id
            ? 'bg-teal-500/30 border-teal-300'
            : 'bg-slate-900/80 border-white/15 hover:bg-slate-800'
        }`}
        title={ch.name}
        aria-label={ch.name}
      >
        <span className="text-3xl sm:text-4xl leading-none">{ch.icon}</span>
        <span className="text-xs font-black text-white/70 mt-1">{ch.id}</span>
      </button>
    ))}
  </div>
);

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  isMuted,
  onToggleMute,
  counts,
  onOpenGrownUps,
  onOpenShop,
  isNight,
  onToggleNight,
  continueChapter,
  onContinue,
  dailyMissions,
  onOpenDailyMissions,
  playerName,
  askForName,
  onSetName,
  friendsMet,
  friendsTotal,
  onOpenFriends,
}) => {
  const [showPlaces, setShowPlaces] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const showNameCard = askForName || editingName;
  const isTouch = useIsTouchDevice();

  const doneMissions = dailyMissions.missions.filter((m) => m.completed).length;
  const totalMissions = dailyMissions.missions.length;

  const pill =
    'pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-950/80 border border-white/10 text-white text-sm font-bold shadow-lg transition active:scale-95 cursor-pointer';

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 w-full max-w-5xl mx-auto">
        <button onClick={onOpenDailyMissions} className={pill} aria-label="Today's missions">
          <span className="text-lg leading-none">🎯</span>
          <span className="tabular-nums">
            {doneMissions}/{totalMissions}
          </span>
          {dailyMissions.streakDays > 0 && (
            <span className="text-orange-300 tabular-nums">🔥{dailyMissions.streakDays}</span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleNight}
            className={`${pill} px-3 text-xl`}
            aria-label={isNight ? 'Switch to daytime' : 'Switch to night time'}
            title={isNight ? 'Daytime' : 'Night time'}
          >
            {isNight ? '🌙' : '☀️'}
          </button>
          <button
            onClick={onOpenGrownUps}
            className={`${pill} text-xs font-semibold text-white/80`}
            title="Save progress & settings"
          >
            <Settings className="w-4 h-4" />
            <span>Grown-ups</span>
          </button>
          <button
            onClick={onToggleMute}
            className={`${pill} px-2.5`}
            aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-rose-300" />
            ) : (
              <Volume2 className="w-5 h-5 text-emerald-300" />
            )}
          </button>
        </div>
      </div>

      {/* Center */}
      <div className="w-full max-w-md mx-auto flex flex-col items-center text-center">
        <svg
          viewBox="0 0 600 130"
          className="w-full max-w-lg drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
          role="img"
          aria-label="Whiskers' River Journey"
        >
          <defs>
            <linearGradient id="titleGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff3b0" />
              <stop offset="45%" stopColor="#ffd166" />
              <stop offset="100%" stopColor="#ff7b00" />
            </linearGradient>
          </defs>
          <path
            d="M 30 115 Q 120 128 220 115 T 410 115 T 570 118"
            fill="none"
            stroke="#2dd4bf"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <text
            x="300"
            y="60"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="54"
            fill="url(#titleGoldGrad)"
            stroke="#7c2d12"
            strokeWidth="2"
            paintOrder="stroke"
            letterSpacing="2"
          >
            WHISKERS'
          </text>
          <text
            x="300"
            y="104"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="800"
            fontSize="34"
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="2"
            paintOrder="stroke"
            letterSpacing="3"
          >
            RIVER JOURNEY
          </text>
        </svg>

        {showNameCard ? (
          <div className="mt-2 w-full flex justify-center">
            <NameCard
              initial={playerName}
              onDone={(name) => {
                onSetName(name);
                setEditingName(false);
              }}
            />
          </div>
        ) : (
          <>
            {playerName ? (
              <button
                onClick={() => setEditingName(true)}
                className="pointer-events-auto mt-1 mb-4 flex items-center gap-2 text-white text-2xl font-black drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] cursor-pointer"
                aria-label={`Hi, ${playerName}! Tap to change your name`}
              >
                <span>Hi, {playerName}! 👋</span>
                <Pencil className="w-4 h-4 text-white/70" />
              </button>
            ) : (
              <p className="mt-1 mb-5 text-white text-base sm:text-lg font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
                Help Whiskers swim home to the Grand Lake! 🏝️
              </p>
            )}

            {continueChapter ? (
              <>
                <button
                  onClick={onContinue}
                  className="pointer-events-auto w-full max-w-xs py-4 rounded-3xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-4 border-white/80 text-white text-3xl font-black shadow-2xl shadow-emerald-900/40 flex flex-col items-center justify-center transition active:scale-95 hover:brightness-110 cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <Play className="w-8 h-8 fill-white" />
                    <span>Continue</span>
                  </span>
                  <span className="text-sm font-bold text-white/90">
                    {continueChapter.icon} {continueChapter.name}
                  </span>
                </button>
                <button
                  onClick={() => onStartGame(0)}
                  className="pointer-events-auto mt-2 px-4 py-1.5 rounded-full bg-slate-950/70 border border-white/15 text-white/90 text-sm font-bold transition active:scale-95 cursor-pointer"
                >
                  ↺ Start from the beginning
                </button>
              </>
            ) : (
              <button
                onClick={() => onStartGame(0)}
                className="pointer-events-auto w-full max-w-xs py-5 rounded-3xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-4 border-white/80 text-white text-3xl font-black shadow-2xl shadow-emerald-900/40 flex items-center justify-center gap-3 transition active:scale-95 hover:brightness-110 cursor-pointer"
              >
                <Play className="w-8 h-8 fill-white" />
                <span>Play</span>
              </button>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setShowPlaces((v) => !v)}
                className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/15 text-white text-base font-bold shadow-lg transition active:scale-95 cursor-pointer"
              >
                <MapIcon className="w-5 h-5 text-teal-300" />
                <span>Pick a place</span>
              </button>
              <button
                onClick={onOpenFriends}
                className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/15 text-white text-base font-bold shadow-lg transition active:scale-95 cursor-pointer"
              >
                <span className="text-lg leading-none">📖</span>
                <span>
                  Friends{' '}
                  <span className="tabular-nums text-amber-300">
                    {friendsMet}/{friendsTotal}
                  </span>
                </span>
              </button>
              <button
                onClick={onOpenShop}
                className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-pink-500/90 border border-white/30 text-white text-base font-bold shadow-lg transition active:scale-95 cursor-pointer"
              >
                <span className="text-lg leading-none">👒</span>
                <span>Dress up</span>
              </button>
            </div>

            {showPlaces && (
              <div className="mt-3 w-full p-3 rounded-3xl bg-slate-950/85 border border-white/10 shadow-2xl">
                <PlacePicker onPick={onStartGame} />
              </div>
            )}

            {(counts.stars > 0 || counts.treasuresTotal > 0) && (
              <div className="mt-4 flex items-center gap-4 px-4 py-2 rounded-full bg-slate-950/70 border border-white/10 text-white font-black text-lg tabular-nums">
                <span>⭐ {counts.stars}</span>
                <span>💎 {counts.treasuresTotal}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* How to play */}
      <div className="w-full flex justify-center">
        <div className="px-4 py-2 rounded-2xl bg-slate-950/75 border border-white/10 text-white/90 text-sm font-semibold text-center">
          {isTouch
            ? '🐟 Move the fish button to swim · ⚡ Zoom · 👃 Sniff for snacks and friends'
            : '⬅️ ➡️ ⬆️ ⬇️ Swim · Space Zoom · E Sniff for snacks and friends · Esc Pause'}
        </div>
      </div>
    </div>
  );
};
