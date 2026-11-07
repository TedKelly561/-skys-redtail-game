import React from 'react';
import { User } from 'firebase/auth';
import { X, Cloud, CloudOff, LogOut, CheckCircle2 } from 'lucide-react';
import { PaceMode, TreasureCounts } from '../game/engine';
import { CHAPTERS } from '../game/worldGen';

export const OfficialGoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ onClick, disabled, label = 'Sign in with Google' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-800 font-semibold text-sm shadow-md border border-slate-300 transition active:scale-95 cursor-pointer disabled:opacity-60"
  >
    <svg viewBox="0 0 48 48" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
    <span>{label}</span>
  </button>
);

interface GrownUpsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isLoggingIn: boolean;
  loginError: string | null;
  onLogin: () => void;
  onLogout: () => void;
  isCloudSynced: boolean;
  counts: TreasureCounts;
  highestChapter: number;
  paceMode: PaceMode;
  onChangePace: (pace: PaceMode) => void;
}

export const GrownUpsModal: React.FC<GrownUpsModalProps> = ({
  isOpen,
  onClose,
  user,
  isLoggingIn,
  loginError,
  onLogin,
  onLogout,
  isCloudSynced,
  counts,
  highestChapter,
  paceMode,
  onChangePace,
}) => {
  if (!isOpen) return null;

  const chapter = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, highestChapter - 1))];

  return (
    <div
      className="absolute inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 select-none pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white">For Grown-ups</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cloud save */}
        <section className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 mb-3">
          <div className="flex items-center gap-2 mb-2 text-sm font-bold text-teal-200">
            {user ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
            <span>Save progress</span>
          </div>

          {!user ? (
            <>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                Progress is saved on this device. Sign in with Google to keep it in the cloud and
                use it on other devices. The game only sees your name and email address.
              </p>
              <OfficialGoogleSignInButton
                onClick={onLogin}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Signing in…' : 'Sign in with Google'}
              />
              {loginError && <p className="text-xs text-rose-300 mt-2">{loginError}</p>}
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-8 h-8 rounded-full shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-teal-500 text-slate-950 font-bold flex items-center justify-center shrink-0">
                    {(user.displayName || user.email || 'E')[0].toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-xs text-emerald-300 flex items-center gap-1">
                    {isCloudSynced ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved to the cloud
                      </>
                    ) : (
                      'Saving…'
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          )}
        </section>

        {/* Swim length */}
        <section className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 mb-3">
          <div className="text-sm font-bold text-orange-200 mb-2">Swim length</div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { mode: 'cozy', label: 'Short swim', hint: 'about 8 minutes' },
                { mode: 'epic', label: 'Long swim', hint: 'about 15 minutes' },
              ] as { mode: PaceMode; label: string; hint: string }[]
            ).map((opt) => (
              <button
                key={opt.mode}
                onClick={() => onChangePace(opt.mode)}
                className={`py-2.5 px-3 rounded-xl text-left transition cursor-pointer border ${
                  paceMode === opt.mode
                    ? 'bg-orange-500 border-orange-300 text-slate-950'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <div className="text-sm font-bold">{opt.label}</div>
                <div className="text-[11px] opacity-80">{opt.hint}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Progress summary */}
        <section className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <div className="text-sm font-bold text-amber-200 mb-2">Progress so far</div>
          <ul className="text-xs text-slate-300 space-y-1 tabular-nums">
            <li>⭐ {counts.stars} stars · 💎 {counts.treasuresTotal} treasures</li>
            <li>
              🪨 {counts.smoothStones} · ✨ {counts.shimmeringScales} · 🧭 {counts.lostTrinkets} ·
              🦪 {counts.riverPearls}
            </li>
            <li>🐛 {counts.foodEaten} snacks eaten</li>
            <li>🏆 {counts.totalPoints.toLocaleString()} points</li>
            <li>
              🗺️ Furthest: {chapter.id}. {chapter.name}
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};
