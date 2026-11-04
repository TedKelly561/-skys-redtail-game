import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  X,
  Trophy,
  Sparkles,
  Mail,
  LogOut,
  CheckCircle2,
  Cloud,
  RefreshCw,
  Send,
  AlertCircle,
} from 'lucide-react';
import { TreasureCounts } from '../game/engine';
import {
  GmailReportSummary,
  PlayerProgressData,
  fetchPastGmailPointReports,
  sendGmailPointReport,
} from '../services/firebaseAuthAndPoints';

interface GmailPointTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  hasGmailToken: boolean;
  isLoggingIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
  counts: TreasureCounts;
  furthestDistance: number;
  highestChapter: number;
  isCloudSynced: boolean;
}

export const OfficialGoogleSignInButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ onClick, disabled, label = 'Sign in with Google' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="gsi-material-button inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs shadow-md border border-slate-300 transition active:scale-95 cursor-pointer disabled:opacity-60"
  >
    <div className="gsi-material-button-icon w-4 h-4 flex-shrink-0">
      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
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
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    </div>
    <span className="gsi-material-button-contents">{label}</span>
  </button>
);

export const GmailPointTrackerModal: React.FC<GmailPointTrackerModalProps> = ({
  isOpen,
  onClose,
  user,
  hasGmailToken,
  isLoggingIn,
  onLogin,
  onLogout,
  counts,
  furthestDistance,
  highestChapter,
  isCloudSynced,
}) => {
  const [pastReports, setPastReports] = useState<GmailReportSummary[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  const loadReports = async () => {
    if (!user || !hasGmailToken) return;
    setLoadingReports(true);
    try {
      const list = await fetchPastGmailPointReports();
      setPastReports(list);
    } catch {
      // ignore
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (isOpen && user && hasGmailToken) {
      loadReports();
    }
  }, [isOpen, user, hasGmailToken]);

  if (!isOpen) return null;

  const handleConfirmSendReport = async () => {
    if (!user?.email) return;
    setSendingEmail(true);
    setEmailStatusMsg(null);
    try {
      const progress: PlayerProgressData = {
        uid: user.uid,
        displayName: user.displayName || 'River Explorer',
        totalPoints: counts.totalPoints,
        starsCollected: counts.stars,
        treasuresCollected: counts.treasuresTotal,
        foodEaten: counts.foodEaten,
        furthestDistance,
        highestChapter,
        smoothStones: counts.smoothStones,
        lostTrinkets: counts.lostTrinkets,
        shimmeringScales: counts.shimmeringScales,
        riverPearls: counts.riverPearls,
      };
      const ok = await sendGmailPointReport(user.email, progress);
      setShowSendConfirm(false);
      if (ok) {
        setEmailStatusMsg(`Point Report sent to ${user.email}!`);
        loadReports();
      } else {
        setEmailStatusMsg('Could not send email report. Please re-authenticate with Google.');
      }
    } catch {
      setShowSendConfirm(false);
      setEmailStatusMsg('Please sign in with Google to authorize sending your Gmail Point Report.');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 select-none pointer-events-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-teal-500/40 rounded-3xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                Explorer Point & Treasure Log
              </h2>
              <p className="text-xs text-slate-400">
                Track your shiny river treasures & save your points with Gmail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account / Gmail Status Card */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Explorer'}
                  className="w-10 h-10 rounded-full border border-teal-400"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center font-bold text-white">
                  {(user.displayName || user.email || 'E')[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{user.displayName || 'River Explorer'}</span>
                  {isCloudSynced && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                      <Cloud className="w-3 h-3" /> Cloud Saved
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">{user.email}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-teal-400" />
              <div>
                <div className="text-sm font-bold text-white">Sign in with Gmail</div>
                <div className="text-xs text-slate-400">
                  Save your points to the cloud and email yourself Explorer Point Certificates!
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {!user ? (
              <OfficialGoogleSignInButton
                onClick={onLogin}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
              />
            ) : (
              <>
                {!hasGmailToken && (
                  <OfficialGoogleSignInButton
                    onClick={onLogin}
                    disabled={isLoggingIn}
                    label="Connect Gmail Report"
                  />
                )}
                <button
                  onClick={onLogout}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Total Score Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-teal-500/20 border border-amber-400/40 mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Total Explorer Score
            </div>
            <div className="text-3xl font-black text-white tabular-nums">
              {counts.totalPoints.toLocaleString()} <span className="text-lg text-amber-300">pts</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-300 font-semibold">
              Golden Stars: <strong className="text-amber-300">{counts.stars} ⭐</strong>
            </div>
            <div className="text-xs text-slate-300 font-semibold">
              Snacks Eaten: <strong className="text-emerald-300">{counts.foodEaten} 🐛</strong>
            </div>
            <div className="text-xs text-slate-400">
              Best Swim: {furthestDistance}m (Chapter {highestChapter})
            </div>
          </div>
        </div>

        {/* Shiny Treasures Collection Grid */}
        <div className="mb-5">
          <div className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Shiny River Treasures Collected ({counts.treasuresTotal} Total)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-teal-500/30 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">🪨</span>
              <div className="text-lg font-black text-teal-300 tabular-nums">
                {counts.smoothStones}
              </div>
              <div className="text-[11px] font-bold text-slate-200">Smooth Stones</div>
              <div className="text-[10px] text-slate-400">+15 pts each</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-sky-500/30 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">✨</span>
              <div className="text-lg font-black text-sky-300 tabular-nums">
                {counts.shimmeringScales}
              </div>
              <div className="text-[11px] font-bold text-slate-200">Shimmering Scales</div>
              <div className="text-[10px] text-slate-400">+25 pts each</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-amber-500/30 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">🧭</span>
              <div className="text-lg font-black text-amber-300 tabular-nums">
                {counts.lostTrinkets}
              </div>
              <div className="text-[11px] font-bold text-slate-200">Lost Trinkets</div>
              <div className="text-[10px] text-slate-400">+40 pts each</div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-indigo-500/30 flex flex-col items-center text-center">
              <span className="text-2xl mb-1">🦪</span>
              <div className="text-lg font-black text-indigo-300 tabular-nums">
                {counts.riverPearls}
              </div>
              <div className="text-[11px] font-bold text-slate-200">River Pearls</div>
              <div className="text-[10px] text-slate-400">+30 pts each</div>
            </div>
          </div>
        </div>

        {/* Gmail Point Report Feature */}
        {user && (
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>Gmail Explorer Point Certificate</span>
                </div>
                <p className="text-xs text-slate-400">
                  Email a summary of Whiskers' points and shiny treasures to {user.email}
                </p>
              </div>

              {hasGmailToken ? (
                <button
                  onClick={() => setShowSendConfirm(true)}
                  disabled={sendingEmail}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Email Point Report to Gmail</span>
                </button>
              ) : (
                <OfficialGoogleSignInButton
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  label="Authorize Gmail Report"
                />
              )}
            </div>

            {/* Mandatory Explicit User Confirmation Dialog before sending Gmail */}
            {showSendConfirm && (
              <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-400/60 mb-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-amber-200 mb-1">
                      Confirm Sending Email via Gmail?
                    </div>
                    <p className="text-xs text-amber-100/90 mb-3">
                      This will send 1 email titled{' '}
                      <strong>
                        "Whiskers' River Journey Point Report - {counts.totalPoints} Points!"
                      </strong>{' '}
                      to your Gmail address (<strong>{user.email}</strong>).
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleConfirmSendReport}
                        disabled={sendingEmail}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition cursor-pointer"
                      >
                        {sendingEmail ? 'Sending...' : 'Confirm & Send Email'}
                      </button>
                      <button
                        onClick={() => setShowSendConfirm(false)}
                        disabled={sendingEmail}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {emailStatusMsg && (
              <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-3 py-2 rounded-xl mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{emailStatusMsg}</span>
              </div>
            )}

            {/* Past Gmail Point Reports List */}
            {hasGmailToken && (
              <div className="mt-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Past Point Reports in Your Gmail
                  </span>
                  <button
                    onClick={loadReports}
                    className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingReports ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
                {pastReports.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No point report emails sent yet. Click "Email Point Report to Gmail" above to save a milestone!
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {pastReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="truncate pr-2">
                          <div className="font-semibold text-slate-200 truncate">{rep.subject}</div>
                          <div className="text-[10px] text-slate-400 truncate">{rep.snippet}</div>
                        </div>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          {rep.date ? new Date(rep.date).toLocaleDateString() : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
