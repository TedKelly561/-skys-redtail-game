import React, { useState } from 'react';
import { Play, Volume2, VolumeX, Compass, Sparkles, Fish, Trophy, Gem } from 'lucide-react';
import { User } from 'firebase/auth';
import { CHAPTERS } from '../game/worldGen';
import { PaceMode, TreasureCounts } from '../game/engine';
import { OfficialGoogleSignInButton } from './GmailPointTrackerModal';

interface TitleScreenProps {
  onStartGame: (chapterIdx: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  paceMode: PaceMode;
  onChangePace: (pace: PaceMode) => void;
  counts: TreasureCounts;
  user: User | null;
  isLoggingIn: boolean;
  onLogin: () => void;
  onOpenPointTracker: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  isMuted,
  onToggleMute,
  paceMode,
  onChangePace,
  counts,
  user,
  isLoggingIn,
  onLogin,
  onOpenPointTracker,
}) => {
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [showChapters, setShowChapters] = useState(false);

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto flex flex-col justify-between p-5 md:p-8 select-none">
      {/* Top Bar with Gmail Login, Points, Treasures & Sound */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/75 border border-emerald-500/30 text-emerald-200 text-xs font-medium tracking-wide">
          <Fish className="w-4 h-4 text-orange-400" />
          <span>Cozy 3D Redtail Catfish Adventure</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Points & Treasures Pill (opens Point Tracker Modal) */}
          <button
            onClick={onOpenPointTracker}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/80 hover:bg-amber-900/80 border border-amber-400/50 text-amber-200 text-xs font-bold tabular-nums transition cursor-pointer shadow-lg"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>{counts.totalPoints.toLocaleString()} pts</span>
            <span className="text-amber-500/60">|</span>
            <Gem className="w-3.5 h-3.5 text-teal-300" />
            <span>{counts.treasuresTotal} Treasures</span>
            <span className="text-amber-500/60">|</span>
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>{counts.stars} ⭐</span>
          </button>

          {/* Official Google / Gmail Sign-In or User Profile Pill */}
          {!user ? (
            <OfficialGoogleSignInButton
              onClick={onLogin}
              disabled={isLoggingIn}
              label={isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
            />
          ) : (
            <button
              onClick={onOpenPointTracker}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-teal-400/50 text-teal-200 text-xs font-semibold transition cursor-pointer"
              title="Open Gmail Point Tracker"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Explorer'}
                  className="w-4 h-4 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="w-4 h-4 rounded-full bg-teal-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">
                  {(user.displayName || user.email || 'E')[0].toUpperCase()}
                </span>
              )}
              <span className="max-w-[130px] truncate">{user.displayName || user.email}</span>
            </button>
          )}

          <button
            onClick={onToggleMute}
            className="p-2 rounded-full bg-slate-900/75 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition active:scale-95 cursor-pointer"
            aria-label="Toggle Mute"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Hero Centerpiece: Bespoke SVG Title Lockup */}
      <div className="w-full max-w-xl mx-auto text-center flex flex-col items-center">
        <div className="relative mb-2">
          <svg
            viewBox="0 0 600 130"
            className="w-full max-w-lg filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
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
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.85"
            />

            <text
              x="300"
              y="60"
              textAnchor="middle"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              fontSize="48"
              fill="url(#titleGoldGrad)"
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
              letterSpacing="3"
            >
              RIVER JOURNEY
            </text>
          </svg>

          <div className="inline-block mt-1 px-4 py-1 rounded-full bg-orange-950/85 border border-orange-500/40 text-orange-200 text-xs tracking-wider uppercase font-semibold">
            Redtail Catfish Treasure & Foraging Quest
          </div>
        </div>

        <p className="text-slate-100 text-sm md:text-base max-w-lg mx-auto mb-5 text-center leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
          Guide <strong className="text-orange-400 font-semibold">Whiskers the Redtail Catfish</strong> down sunlit Amazon bends! Snack on plentiful larvae & silver minnows to keep your hunger bar full, collect smooth jade stones, shimmering scales & lost trinkets, and swim to the Great Grand Lake!
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <button
            onClick={() => onStartGame(selectedChapter)}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 font-bold text-base md:text-lg shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-emerald-300/40"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>Start River Swim</span>
          </button>

          <button
            onClick={() => setShowChapters(!showChapters)}
            className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-900/85 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-700/80 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Compass className="w-4 h-4 text-teal-400" />
            <span>Choose Chapter ({CHAPTERS[selectedChapter].name})</span>
          </button>
        </div>

        {/* Chapter Selection Drawer */}
        {showChapters && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-950/90 border border-teal-500/30 max-w-lg w-full text-left shadow-2xl">
            <div className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-2">
              Select River Reach to Explore:
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {CHAPTERS.map((chap, idx) => (
                <button
                  key={chap.id}
                  onClick={() => {
                    setSelectedChapter(idx);
                    setShowChapters(false);
                  }}
                  className={`p-2.5 rounded-xl text-left text-xs transition flex items-center justify-between cursor-pointer ${
                    selectedChapter === idx
                      ? 'bg-teal-900/70 border border-teal-400/60 text-white font-bold'
                      : 'bg-slate-900/50 hover:bg-slate-800 text-slate-300 border border-transparent'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-100">
                      {chap.id}. {chap.name}
                    </div>
                    <div className="text-[11px] text-slate-400">{chap.subtitle}</div>
                  </div>
                  {idx === 4 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      Paradise
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Journey Pacing Selection */}
        <div className="mt-4 flex items-center gap-2 p-1.5 rounded-xl bg-slate-950/75 border border-slate-800 text-xs">
          <span className="text-slate-400 px-2 font-medium">Session Length:</span>
          <button
            onClick={() => onChangePace('epic')}
            className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
              paceMode === 'epic'
                ? 'bg-orange-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            30-Min Grand Expedition
          </button>
          <button
            onClick={() => onChangePace('cozy')}
            className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
              paceMode === 'cozy'
                ? 'bg-orange-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            10-Min Quick Splash
          </button>
        </div>
      </div>

      {/* Flat Control Hints at Bottom */}
      <div className="w-full max-w-2xl mx-auto text-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-950/85 border border-slate-800 text-slate-300 text-xs font-mono tracking-wide">
          <span>WASD / Arrows / Drag: Steer & Dive</span>
          <span className="text-slate-600">·</span>
          <span>Space: Tail Boost</span>
          <span className="text-slate-600">·</span>
          <span>E: Barbel Sniffer</span>
          <span className="text-slate-600">·</span>
          <span>Esc: Pause</span>
        </div>
      </div>
    </div>
  );
};
