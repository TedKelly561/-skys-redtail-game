/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { GameEngine, GameState, PaceMode, TreasureCounts } from './game/engine';
import { CHAPTERS, RiverChapterInfo } from './game/worldGen';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { PauseMenu } from './components/PauseMenu';
import { GrandLakeVictory } from './components/GrandLakeVictory';
import { GmailPointTrackerModal } from './components/GmailPointTrackerModal';
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
  const [distance, setDistance] = useState<number>(0);
  const [totalDistance, setTotalDistance] = useState<number>(2650);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentChapter, setCurrentChapter] = useState<RiverChapterInfo>(CHAPTERS[0]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [tipMessage, setTipMessage] = useState<string | null>(null);
  const [treasurePopup, setTreasurePopup] = useState<{
    label: string;
    points: number;
    icon: string;
  } | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getIsMuted());
  const [paceMode, setPaceMode] = useState<PaceMode>('epic');

  // Google / Gmail Auth & Cloud Sync State
  const [user, setUser] = useState<User | null>(null);
  const [hasGmailToken, setHasGmailToken] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [isPointTrackerOpen, setIsPointTrackerOpen] = useState<boolean>(false);

  const tipTimeoutRef = useRef<number | null>(null);
  const popupTimeoutRef = useRef<number | null>(null);
  const saveDebounceRef = useRef<number | null>(null);

  const showTip = useCallback((msg: string) => {
    setTipMessage(msg);
    if (tipTimeoutRef.current) {
      window.clearTimeout(tipTimeoutRef.current);
    }
    tipTimeoutRef.current = window.setTimeout(() => {
      setTipMessage(null);
    }, 4500);
  }, []);

  const showPopup = useCallback((label: string, points: number, icon: string) => {
    setTreasurePopup({ label, points, icon });
    if (popupTimeoutRef.current) {
      window.clearTimeout(popupTimeoutRef.current);
    }
    popupTimeoutRef.current = window.setTimeout(() => {
      setTreasurePopup(null);
    }, 2600);
  }, []);

  // Initialize Firebase Auth & load cloud points
  useEffect(() => {
    const unsubscribe = initAuth(
      async (authUser, token) => {
        setUser(authUser);
        setHasGmailToken(Boolean(token));
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
        setHasGmailToken(false);
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
      onDistanceChange: (dist, tot, pct) => {
        setDistance(dist);
        setTotalDistance(tot);
        setProgressPercent(pct);
      },
      onChapterChange: (chap) => setCurrentChapter(chap),
      onStateChange: (state) => setGameState(state),
      onTimeChange: (sec) => setElapsedSeconds(sec),
      onTipMessage: (msg) => showTip(msg),
      onTreasurePopup: (label, pts, icon) => showPopup(label, pts, icon),
    });

    engineRef.current = engine;
    setPaceMode(engine.paceMode);
    setCounts({ ...engine.counts });

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
      if (!engine || isPointTrackerOpen) return;

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
  }, [gameState, isPointTrackerOpen]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setHasGmailToken(Boolean(result.accessToken));
        showTip(`Signed in with Google as ${result.user.displayName || result.user.email}!`);
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setHasGmailToken(false);
    setIsCloudSynced(false);
    showTip('Signed out of Google.');
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
    setGameState('playing');
    if (engineRef.current) {
      engineRef.current.gameState = 'playing';
      showTip('Enjoy free swimming in the Grand Lake with your Redtail Catfish family!');
    }
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
          paceMode={paceMode}
          onChangePace={handleChangePace}
          counts={counts}
          user={user}
          isLoggingIn={isLoggingIn}
          onLogin={handleLogin}
          onOpenPointTracker={() => setIsPointTrackerOpen(true)}
        />
      )}

      {/* Active Game HUD */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <GameHUD
          tummy={tummy}
          counts={counts}
          distance={distance}
          totalDistance={totalDistance}
          progressPercent={progressPercent}
          chapter={currentChapter}
          elapsedSeconds={elapsedSeconds}
          tipMessage={tipMessage}
          treasurePopup={treasurePopup}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onTriggerSonar={handleTriggerSonar}
          onSetBoost={handleSetBoost}
          onVirtualSteer={handleVirtualSteer}
          user={user}
          onOpenPointTracker={() => setIsPointTrackerOpen(true)}
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
          paceMode={paceMode}
          onChangePace={handleChangePace}
          counts={counts}
          tummy={tummy}
          onOpenPointTracker={() => setIsPointTrackerOpen(true)}
        />
      )}

      {/* Grand Lake Victory Celebration Modal */}
      {gameState === 'victory' && (
        <GrandLakeVictory
          counts={counts}
          elapsedSeconds={elapsedSeconds}
          onFreeSwim={handleFreeSwim}
          onRestart={handleRestart}
          onOpenPointTracker={() => setIsPointTrackerOpen(true)}
        />
      )}

      {/* Gmail Login & Cloud Point Tracker Modal */}
      <GmailPointTrackerModal
        isOpen={isPointTrackerOpen}
        onClose={() => setIsPointTrackerOpen(false)}
        user={user}
        hasGmailToken={hasGmailToken}
        isLoggingIn={isLoggingIn}
        onLogin={handleLogin}
        onLogout={handleLogout}
        counts={counts}
        furthestDistance={engineRef.current?.furthestDistanceReached || distance}
        highestChapter={engineRef.current?.highestChapterReached || currentChapter.id}
        isCloudSynced={isCloudSynced}
      />
    </div>
  );
}
