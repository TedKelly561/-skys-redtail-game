/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { GameEngine, GameState, PaceMode, TreasureCounts } from './game/engine';
import { CHAPTERS, RiverChapterInfo } from './game/worldGen';
import { DailyMissionsState, DailyMissionsManager } from './game/dailyMissions';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD, TreasurePopupInfo } from './components/GameHUD';
import { PauseMenu } from './components/PauseMenu';
import { GrandLakeVictory } from './components/GrandLakeVictory';
import { GrownUpsModal } from './components/GrownUpsModal';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { sound } from './game/audio';
import {
  initAuth,
  googleSignIn,
  logout,
  loadUserProgress,
  saveUserProgress,
} from './services/firebaseAuthAndPoints';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // React UI States (Decoupled from 60fps WebGL loop)
  const [gameState, setGameState] = useState<GameState>('title');
  const [tummy, setTummy] = useState<number>(95);
  const [counts, setCounts] = useState<TreasureCounts>({
    totalPoints: 0,
    stars: 0,
    treasuresTotal: 0,
    smoothStones: 0,
    shimmeringScales: 0,
    lostTrinkets: 0,
    riverPearls: 0,
    foodEaten: 0,
  });
  const [dailyMissions, setDailyMissions] = useState<DailyMissionsState>(() =>
    new DailyMissionsManager().getState()
  );
  const [isDailyMissionsOpen, setIsDailyMissionsOpen] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentChapter, setCurrentChapter] = useState<RiverChapterInfo>(CHAPTERS[0]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [tipMessage, setTipMessage] = useState<string | null>(null);
  const [treasurePopup, setTreasurePopup] = useState<TreasurePopupInfo | null>(null);
  const [sniffReady, setSniffReady] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getIsMuted());
  const [paceMode, setPaceMode] = useState<PaceMode>('cozy');

  // Google sign-in & cloud save state
  const [user, setUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [isGrownUpsOpen, setIsGrownUpsOpen] = useState<boolean>(false);

  const tipTimeoutRef = useRef<number | null>(null);
  const popupTimeoutRef = useRef<number | null>(null);
  const saveDebounceRef = useRef<number | null>(null);
  const popupIdRef = useRef<number>(0);

  const showTip = useCallback((msg: string) => {
    setTipMessage(msg);
    if (tipTimeoutRef.current) {
      window.clearTimeout(tipTimeoutRef.current);
    }
    tipTimeoutRef.current = window.setTimeout(() => {
      setTipMessage(null);
    }, 3500);
  }, []);

  const showPopup = useCallback((label: string, points: number, icon: string) => {
    popupIdRef.current += 1;
    setTreasurePopup({ id: popupIdRef.current, label, points, icon });
    if (popupTimeoutRef.current) {
      window.clearTimeout(popupTimeoutRef.current);
    }
    popupTimeoutRef.current = window.setTimeout(() => {
      setTreasurePopup(null);
    }, 1600);
  }, []);

  // Initialize Firebase Auth & load cloud points
  useEffect(() => {
    const unsubscribe = initAuth(
      async (authUser) => {
        setUser(authUser);
        try {
          const cloudData = await loadUserProgress(authUser.uid);
          if (cloudData && engineRef.current) {
            engineRef.current.applyCloudProgress(cloudData);
            setIsCloudSynced(true);
          } else if (engineRef.current) {
            // Save initial local progress to cloud
            const eng = engineRef.current;
            await saveUserProgress({
              uid: authUser.uid,
              displayName: authUser.displayName || 'River Explorer',
              totalPoints: eng.counts.totalPoints,
              starsCollected: eng.counts.stars,
              treasuresCollected: eng.counts.treasuresTotal,
              foodEaten: eng.counts.foodEaten,
              furthestDistance: eng.furthestDistanceReached,
              highestChapter: eng.highestChapterReached,
              smoothStones: eng.counts.smoothStones,
              lostTrinkets: eng.counts.lostTrinkets,
              shimmeringScales: eng.counts.shimmeringScales,
              riverPearls: eng.counts.riverPearls,
            });
            setIsCloudSynced(true);
          }
        } catch (err) {
          console.error('Error syncing cloud progress:', err);
        }
      },
      () => {
        setUser(null);
        setIsCloudSynced(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Debounced cloud sync whenever counts update
  useEffect(() => {
    if (!user || !engineRef.current) return;
    if (saveDebounceRef.current) {
      window.clearTimeout(saveDebounceRef.current);
    }
    saveDebounceRef.current = window.setTimeout(async () => {
      if (!engineRef.current || !user) return;
      const eng = engineRef.current;
      try {
        await saveUserProgress({
          uid: user.uid,
          displayName: user.displayName || 'River Explorer',
          totalPoints: counts.totalPoints,
          starsCollected: counts.stars,
          treasuresCollected: counts.treasuresTotal,
          foodEaten: counts.foodEaten,
          furthestDistance: eng.furthestDistanceReached,
          highestChapter: eng.highestChapterReached,
          smoothStones: counts.smoothStones,
          lostTrinkets: counts.lostTrinkets,
          shimmeringScales: counts.shimmeringScales,
          riverPearls: counts.riverPearls,
        });
        setIsCloudSynced(true);
      } catch (e) {
        console.error('Auto-save error:', e);
      }
    }, 2200);
  }, [counts, user]);

  // Initialize GameEngine inside useEffect once
  useEffect(() => {
    if (!mountRef.current) return;

    const engine = new GameEngine(mountRef.current, {
      onTummyChange: (val) => setTummy(val),
      onCountsChange: (newCounts) => setCounts(newCounts),
      onDailyMissionsChange: (missionsState) => setDailyMissions(missionsState),
      onDistanceChange: (_dist, _tot, pct) => setProgressPercent(pct),
      // The depth readout isn't shown any more; skipping it avoids re-rendering the UI every frame.
      onStreamDepthChange: () => {},
      onSniffReadyChange: (ready) => setSniffReady(ready),
      onChapterChange: (chap) => setCurrentChapter(chap),
      onStateChange: (state) => setGameState(state),
      onTimeChange: (sec) => setElapsedSeconds(sec),
      onTipMessage: (msg) => showTip(msg),
      onTreasurePopup: (label, pts, icon) => showPopup(label, pts, icon),
    });

    engineRef.current = engine;
    if (import.meta.env.DEV) {
      (window as unknown as { __whiskers?: GameEngine }).__whiskers = engine;
    }
    setPaceMode(engine.paceMode);
    setCounts({ ...engine.counts });
    setDailyMissions(engine.dailyMissionsManager.getState());

    return () => {
      if (tipTimeoutRef.current) window.clearTimeout(tipTimeoutRef.current);
      if (popupTimeoutRef.current) window.clearTimeout(popupTimeoutRef.current);
      if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, [showTip, showPopup]);

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine || isGrownUpsOpen || isDailyMissionsOpen) {
        if (e.code === 'Escape') {
          setIsDailyMissionsOpen(false);
          setIsGrownUpsOpen(false);
        }
        return;
      }

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        engine.inputs.steerLeft = true;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        engine.inputs.steerRight = true;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        engine.inputs.diveDown = true;
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        engine.inputs.riseUp = true;
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'title') {
          engine.startGame(0);
        } else {
          engine.inputs.boost = true;
        }
      } else if (e.code === 'KeyE' || e.code === 'KeyQ') {
        engine.inputs.sonarPulse = true;
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameState === 'playing') {
          engine.pauseGame();
        } else if (gameState === 'paused') {
          engine.resumeGame();
        }
      } else if (e.code === 'Enter') {
        if (gameState === 'title') {
          engine.startGame(0);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        engine.inputs.steerLeft = false;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        engine.inputs.steerRight = false;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        engine.inputs.diveDown = false;
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        engine.inputs.riseUp = false;
      } else if (e.code === 'Space') {
        engine.inputs.boost = false;
      }
    };

    const handleWindowBlur = () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.inputs.steerLeft = false;
      engine.inputs.steerRight = false;
      engine.inputs.diveDown = false;
      engine.inputs.riseUp = false;
      engine.inputs.boost = false;
      engine.inputs.sonarPulse = false;
      engine.touchSteerX = 0;
      engine.touchSteerY = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [gameState, isGrownUpsOpen, isDailyMissionsOpen]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const signedInUser = await googleSignIn();
      setUser(signedInUser);
    } catch (err) {
      console.error('Login failed:', err);
      const code = (err as { code?: string })?.code || '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setLoginError('Sign-in did not work. Please allow pop-ups for this page and try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setIsCloudSynced(false);
  };

  const handleToggleMute = () => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleChangePace = (mode: PaceMode) => {
    setPaceMode(mode);
    if (engineRef.current) {
      engineRef.current.setPaceMode(mode);
    }
  };

  const handleStartGame = (chapterIdx: number) => {
    if (engineRef.current) {
      engineRef.current.startGame(chapterIdx);
    }
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pauseGame();
    }
  };

  const handleResume = () => {
    if (engineRef.current) {
      engineRef.current.resumeGame();
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.restartJourney();
    }
  };

  const handleSelectChapter = (idx: number) => {
    if (engineRef.current) {
      engineRef.current.startGame(idx);
    }
  };

  const handleFreeSwim = () => {
    engineRef.current?.startFreeSwim();
  };

  const handleTriggerSonar = () => {
    if (engineRef.current) {
      engineRef.current.triggerSonarPulse();
    }
  };

  const handleSetBoost = (boosting: boolean) => {
    if (engineRef.current) {
      engineRef.current.inputs.boost = boosting;
    }
  };

  const handleVirtualSteer = (x: number, y: number) => {
    if (engineRef.current) {
      engineRef.current.touchSteerX = x;
      engineRef.current.touchSteerY = y;
    }
  };

  // Opening the missions list mid-swim pauses the game so Whiskers doesn't swim on alone.
  const openDailyMissions = () => {
    if (engineRef.current?.gameState === 'playing') {
      engineRef.current.pauseGame();
    }
    setIsDailyMissionsOpen(true);
  };

  const handleRequestNextBonusSet = () => {
    if (engineRef.current) {
      engineRef.current.startNextDailyMissionBonusSet();
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Isolated Three.js Canvas Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          counts={counts}
          onOpenGrownUps={() => setIsGrownUpsOpen(true)}
          dailyMissions={dailyMissions}
          onOpenDailyMissions={openDailyMissions}
        />
      )}

      {/* Active Game HUD */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <GameHUD
          tummy={tummy}
          counts={counts}
          progressPercent={progressPercent}
          chapter={currentChapter}
          elapsedSeconds={elapsedSeconds}
          tipMessage={tipMessage}
          treasurePopup={treasurePopup}
          sniffReady={sniffReady}
          onPause={handlePause}
          onTriggerSonar={handleTriggerSonar}
          onSetBoost={handleSetBoost}
          onVirtualSteer={handleVirtualSteer}
          dailyMissions={dailyMissions}
          onOpenDailyMissions={openDailyMissions}
        />
      )}

      {/* Pause Menu Modal */}
      {gameState === 'paused' && (
        <PauseMenu
          onResume={handleResume}
          onRestart={handleRestart}
          onSelectChapter={handleSelectChapter}
          currentChapterId={currentChapter.id}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenGrownUps={() => setIsGrownUpsOpen(true)}
        />
      )}

      {/* Grand Lake Victory Celebration Modal */}
      {gameState === 'victory' && (
        <GrandLakeVictory counts={counts} onFreeSwim={handleFreeSwim} onRestart={handleRestart} />
      )}

      {/* Daily Missions & Habit Tracker Modal */}
      <DailyMissionsModal
        isOpen={isDailyMissionsOpen}
        onClose={() => setIsDailyMissionsOpen(false)}
        dailyMissions={dailyMissions}
        onStartNextBonusSet={handleRequestNextBonusSet}
        isTitleScreen={gameState === 'title'}
        onStartSwimIfTitle={() => handleStartGame(0)}
      />

      {/* Grown-ups: cloud save & swim length */}
      <GrownUpsModal
        isOpen={isGrownUpsOpen}
        onClose={() => setIsGrownUpsOpen(false)}
        user={user}
        isLoggingIn={isLoggingIn}
        loginError={loginError}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isCloudSynced={isCloudSynced}
        counts={counts}
        highestChapter={engineRef.current?.highestChapterReached || currentChapter.id}
        paceMode={paceMode}
        onChangePace={handleChangePace}
      />
    </div>
  );
}
