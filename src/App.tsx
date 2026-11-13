/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Difficulty, GameEngine, GameState, MiniGameInfo, PaceMode, TreasureCounts } from './game/engine';
import { CHAPTERS, RiverChapterInfo } from './game/worldGen';
import { DailyMissionsState, DailyMissionsManager } from './game/dailyMissions';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD, TreasurePopupInfo } from './components/GameHUD';
import { PauseMenu } from './components/PauseMenu';
import { GrandLakeVictory } from './components/GrandLakeVictory';
import { GrownUpsModal } from './components/GrownUpsModal';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { StickerBook } from './components/StickerBook';
import { DressUpShop } from './components/DressUpShop';
import { FishHouseRoom } from './components/FishHouseRoom';
import { HouseItem, HouseState, HouseView, loadHouse, saveHouse } from './game/house';
import { BuddyLook, loadBuddy, saveBuddy } from './game/buddy';
import { Photo, framePhoto, loadAlbum, saveAlbum } from './game/photos';
import { Trip, loadTrip } from './game/storybook';
import { Storybook } from './components/Storybook';
import { SeasonSetting, loadSeasonSetting } from './game/seasons';
import { LearningPrompt, loadLearningEnabled } from './game/learning';
import { LearningCard } from './components/LearningCard';
import { debugFlag } from './game/debugFlags';
import { CloudExtras, applyExtrasLocally, collectLocalExtras, mergeExtras, sanitizeExtras } from './game/cloudExtras';
import {
  ProfilesState,
  addProfile,
  collectOtherPlayers,
  isPrimaryProfile,
  loadProfiles,
  packPlayer,
  removeProfile,
  restoreMissingPlayers,
  switchProfile,
  syncActiveProfileName,
} from './game/profiles';
import { PhotoAlbum, PhotoView } from './components/Photos';
import { ClosetItem, ClosetSlot, ClosetState, loadCloset, saveCloset } from './game/closet';
import { sound } from './game/audio';
import { narrator } from './game/voice';
import { music } from './game/music';
import { ANIMAL_FRIEND_COUNT, FriendKind, countAnimalFriends } from './game/friends';
import { getPlayerName, hasBeenAskedForName, setPlayerName as storePlayerName } from './game/profile';
import {
  initAuth,
  googleSignIn,
  logout,
  loadUserProgress,
  saveUserProgress,
  loadUserExtras,
  saveUserExtras,
  loadPlayerBackups,
  savePlayerBackups,
  MAX_BACKUP_CHARS,
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

  // Player name, read-aloud voice and river friends
  const [playerName, setPlayerName] = useState<string>(() => getPlayerName());
  const [askForName, setAskForName] = useState<boolean>(() => !hasBeenAskedForName());
  const [readAloud, setReadAloud] = useState<boolean>(() => narrator.getEnabled());
  const [musicOn, setMusicOn] = useState<boolean>(() => music.getEnabled());
  const [difficulty, setDifficulty] = useState<Difficulty>(() => GameEngine.loadDifficulty());
  const [season, setSeason] = useState<SeasonSetting>(() => loadSeasonSetting());
  const [learningOn, setLearningOn] = useState<boolean>(() => loadLearningEnabled());
  const [learningPrompt, setLearningPrompt] = useState<LearningPrompt | null>(null);
  const [metFriends, setMetFriends] = useState<FriendKind[]>([]);
  const [friendNearby, setFriendNearby] = useState<boolean>(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState<boolean>(false);
  // Dress-up shop: stars to spend = lifetime stars - stars spent.
  const [closet, setCloset] = useState<ClosetState>(() => loadCloset());
  const [tryingOn, setTryingOn] = useState<ClosetItem | null>(null);
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [savedPlace] = useState<number | null>(() => GameEngine.loadSavedPlace());
  // Troubleshooting readout, only with ?debug in the link.
  const [debugStats, setDebugStats] = useState<ReturnType<GameEngine['getDebugStats']> | null>(null);
  useEffect(() => {
    if (!debugFlag('debug')) return;
    const id = window.setInterval(() => {
      if (engineRef.current) setDebugStats(engineRef.current.getDebugStats());
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  // Player profiles (each child on this device has their own progress).
  const [profiles, setProfiles] = useState<ProfilesState>(() => syncActiveProfileName());
  const primaryProfile = profiles.active === profiles.list[0].id;

  // Baby fish buddy (asked for once, after the player's name).
  const [buddy, setBuddy] = useState<BuddyLook | null>(() => loadBuddy());
  const [buddyLater, setBuddyLater] = useState<boolean>(() => {
    try {
      return localStorage.getItem('whiskers_buddy_later') === 'true';
    } catch {
      return false;
    }
  });
  // Photo mode: the photo just taken (shown big) and the little album.
  const [photos, setPhotos] = useState<Photo[]>(() => loadAlbum());
  const [photoShot, setPhotoShot] = useState<string | null>(null);
  const [albumOpen, setAlbumOpen] = useState<boolean>(false);
  const [flash, setFlash] = useState<boolean>(false);
  const [lakeUnlocked, setLakeUnlocked] = useState<boolean>(() => GameEngine.isLakeUnlocked());
  useEffect(() => {
    if (gameState === 'victory') setLakeUnlocked(true);
  }, [gameState]);

  // Storybook of the trip: pops up at the Grand Lake, and opens from the title or pause menu.
  const [story, setStory] = useState<{ trip: Trip; finished: boolean } | null>(null);
  const [storyShownAtLake, setStoryShownAtLake] = useState(false);
  const [hasStory, setHasStory] = useState<boolean>(() => (loadTrip()?.distance ?? 0) > 0);
  const openStory = (finished?: boolean) => {
    const engine = engineRef.current;
    const trip = engine ? engine.getTrip() : loadTrip();
    if (!trip) return;
    if (engine?.gameState === 'playing') engine.pauseGame();
    if (engine && Object.keys(stickers).length === 0) setStickers(engine.drawFriendStickers());
    setPhotos(loadAlbum());
    setStory({ trip, finished: finished ?? trip.reachedLake });
  };
  const closeStory = () => {
    setStory(null);
    setHasStory(true);
  };
  useEffect(() => {
    if (gameState !== 'victory') {
      setStoryShownAtLake(false);
      return;
    }
    // After the family celebration, open the book (only when the river was actually swum).
    const t = window.setTimeout(() => {
      const trip = engineRef.current?.getTrip();
      if (trip && trip.reachedLake && trip.distance > 0) {
        setStoryShownAtLake(true);
        openStory(true);
      }
    }, 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);
  const continueChapter =
    savedPlace === null ? null : [...CHAPTERS].reverse().find((c) => savedPlace >= c.startDist) ?? null;
  const [miniGame, setMiniGame] = useState<MiniGameInfo>({ canHideSeek: false, hideSeekActive: false, race: null, pearls: null });
  const [isNight, setIsNight] = useState<boolean>(() => {
    try {
      return localStorage.getItem('whiskers_night') === 'true';
    } catch {
      return false;
    }
  });
  // Whiskers' fish house in the Grand Lake (decorations also cost stars).
  const [house, setHouse] = useState<HouseState>(() => loadHouse());
  const [inHouse, setInHouse] = useState<boolean>(false);
  const [houseView, setHouseViewState] = useState<HouseView>('room');
  const [sleeping, setSleeping] = useState<boolean>(false);
  const wallet = Math.max(0, counts.stars - closet.spent - house.spent);
  const shownCounts = { ...counts, stars: wallet };
  const [stickers, setStickers] = useState<Partial<Record<FriendKind, string>>>({});

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
    narrator.say(msg);
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

  // Friends, outfits, fish house, lake shortcut and buddy follow the player too (signed in).
  const lastExtrasRef = useRef<string>('');
  // Backup of the other players (cousins, friends) while a grown-up is signed in.
  const lastBackupRef = useRef<string>('');
  const [playersBackedUp, setPlayersBackedUp] = useState(false);
  const backupOtherPlayers = async (uid: string) => {
    const packed = collectOtherPlayers().map((p) => packPlayer(p, MAX_BACKUP_CHARS));
    const key = JSON.stringify(packed);
    if (key === lastBackupRef.current) return;
    if (await savePlayerBackups(uid, packed)) {
      lastBackupRef.current = key;
      setPlayersBackedUp(true);
    }
  };
  const syncPlayerBackups = async (uid: string) => {
    const saved = await loadPlayerBackups(uid);
    if (saved === null) return; // rules not published yet, or offline
    const restored = restoreMissingPlayers(saved);
    if (restored) setProfiles(restored);
    await backupOtherPlayers(uid);
  };
  const applyMergedExtras = (merged: CloudExtras) => {
    const r = applyExtrasLocally(merged);
    setCloset(r.closet);
    setHouse(r.house);
    engineRef.current?.setHouseDecor(r.house.owned);
    if (r.buddy) {
      setBuddy(r.buddy);
      engineRef.current?.setBuddy(r.buddy);
    }
    if (r.lakeUnlocked) setLakeUnlocked(true);
    engineRef.current?.addFriends(r.friends);
  };
  const syncExtrasOnLogin = async (uid: string) => {
    const raw = await loadUserExtras(uid);
    const local = collectLocalExtras();
    const merged = raw ? mergeExtras(local, sanitizeExtras(raw)) : local;
    if (raw) applyMergedExtras(merged);
    if (await saveUserExtras(uid, merged)) lastExtrasRef.current = JSON.stringify(merged);
  };

  // Initialize Firebase Auth & load cloud points
  useEffect(() => {
    const unsubscribe = initAuth(
      async (authUser) => {
        setUser(authUser);
        // Other players are backed up whoever is playing; full cloud save is the first player's.
        syncPlayerBackups(authUser.uid).catch((err) => console.warn('Player backup failed:', err));
        if (!isPrimaryProfile()) return;
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
          await syncExtrasOnLogin(authUser.uid);
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

  // Keep the other players' backup fresh while signed in (only sends when something changed).
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => backupOtherPlayers(user.uid), 60000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') backupOtherPlayers(user.uid);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [user]);

  // Debounced cloud save of the extras whenever any of them change.
  const extrasTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user || !primaryProfile) return;
    if (extrasTimerRef.current) window.clearTimeout(extrasTimerRef.current);
    extrasTimerRef.current = window.setTimeout(async () => {
      const now = collectLocalExtras();
      const key = JSON.stringify(now);
      if (key === lastExtrasRef.current) return;
      if (await saveUserExtras(user.uid, now)) lastExtrasRef.current = key;
    }, 2500);
  }, [user, primaryProfile, closet, house, buddy, metFriends, lakeUnlocked]);

  // Debounced cloud sync whenever counts update
  useEffect(() => {
    if (!user || !engineRef.current || !primaryProfile) return;
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
  }, [counts, user, primaryProfile]);

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
      onFriendsChange: (met) => setMetFriends(met),
      onNearbyFriendChange: (kind) => setFriendNearby(kind !== null),
      onMiniGameChange: (info) => setMiniGame(info),
      onLearningPrompt: (prompt) => setLearningPrompt(prompt),
      onHouseChange: (open) => {
        setInHouse(open);
        setHouseViewState('room');
        setSleeping(false);
      },
      onChapterChange: (chap) => setCurrentChapter(chap),
      onStateChange: (state) => setGameState(state),
      onTimeChange: (sec) => setElapsedSeconds(sec),
      onTipMessage: (msg) => showTip(msg),
      onTreasurePopup: (label, pts, icon) => showPopup(label, pts, icon),
    });

    engineRef.current = engine;
    engine.setHouseDecor(loadHouse().owned);
    engine.setBuddy(loadBuddy());
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
    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && !!e.target.closest('input, textarea, [contenteditable="true"]');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const engine = engineRef.current;
      if (!engine || isGrownUpsOpen || isDailyMissionsOpen || isFriendsOpen || isShopOpen) {
        if (e.code === 'Escape') {
          setIsDailyMissionsOpen(false);
          setIsGrownUpsOpen(false);
          setIsFriendsOpen(false);
          closeShop();
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
  }, [gameState, isGrownUpsOpen, isDailyMissionsOpen, isFriendsOpen, isShopOpen]);

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
    if (nextMuted) narrator.stop();
  };

  const handleSetName = (name: string) => {
    setPlayerName(storePlayerName(name));
    setAskForName(false);
    setProfiles(syncActiveProfileName());
  };

  const handleSetMusic = (on: boolean) => {
    music.setEnabled(on);
    setMusicOn(on);
  };

  const handleSetDifficulty = (level: Difficulty) => {
    engineRef.current?.setDifficulty(level);
    setDifficulty(level);
  };

  // Start the title tune on the first tap (browsers only allow sound after a tap).
  useEffect(() => {
    if (gameState !== 'title') return;
    const begin = () => music.start(0, isNight);
    window.addEventListener('pointerdown', begin, { once: true });
    window.addEventListener('keydown', begin, { once: true });
    return () => {
      window.removeEventListener('pointerdown', begin);
      window.removeEventListener('keydown', begin);
    };
  }, [gameState, isNight]);

  const handleSetReadAloud = (on: boolean) => {
    narrator.setEnabled(on);
    setReadAloud(on);
    if (on) narrator.say('Hello! I will read the messages out loud.', true);
  };

  // The sticker book draws each friend from its 3D model the first time it opens.
  // Show the outfit (or the item being tried on) on Whiskers.
  useEffect(() => {
    const outfit = tryingOn ? { ...closet.outfit, [tryingOn.slot]: tryingOn.id } : closet.outfit;
    engineRef.current?.applyOutfit(outfit);
  }, [closet, tryingOn]);

  const toggleNight = () => {
    const next = !isNight;
    setIsNight(next);
    engineRef.current?.setNight(next);
    narrator.say(next ? 'Night time! Look for the fireflies!' : 'Good morning, Whiskers!', true);
  };

  const takePhoto = async () => {
    const engine = engineRef.current;
    if (!engine || photoShot) return;
    const shot = engine.takePhoto();
    if (!shot) return;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 250);
    engine.pauseGame();
    const names = [playerName, 'Whiskers', buddy?.name].filter((n): n is string => !!n);
    const caption = names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names[0];
    try {
      const framed = await framePhoto(shot, caption);
      setPhotos((prev) => saveAlbum([{ url: framed, at: Date.now() }, ...prev]));
      setPhotoShot(framed);
      narrator.say('What a great picture!', true);
    } catch {
      engine.resumeGame();
    }
  };

  const closePhoto = () => {
    setPhotoShot(null);
    engineRef.current?.resumeGame();
  };

  const changeHouseView = (view: HouseView) => {
    setHouseViewState(view);
    engineRef.current?.setHouseView(view);
    if (view === 'trophies') narrator.say('Look at all the treasures you found!', true);
    else if (view === 'friends') narrator.say('Here are all your friends!', true);
  };

  const buyHouseItem = (item: HouseItem) => {
    if (house.owned.includes(item.id) || wallet < item.price) return;
    const next = { owned: [...house.owned, item.id], spent: house.spent + item.price };
    setHouse(next);
    saveHouse(next);
    engineRef.current?.setHouseDecor(next.owned);
    sound.playMissionComplete();
    narrator.say(`You got a ${item.name.toLowerCase()} for your house!`, true);
  };

  const goToBed = () => {
    if (sleeping) return;
    changeHouseView('bed');
    window.setTimeout(() => setSleeping(true), 900);
    window.setTimeout(() => toggleNight(), 3200);
    window.setTimeout(() => {
      setSleeping(false);
      changeHouseView('room');
    }, 4600);
  };

  const openShop = () => {
    const engine = engineRef.current;
    if (engine?.gameState === 'playing') engine.pauseGame();
    if (engine) engine.showcase = true;
    setIsShopOpen(true);
  };

  function closeShop() {
    setTryingOn(null);
    if (engineRef.current) engineRef.current.showcase = false;
    setIsShopOpen(false);
  }

  const updateCloset = (next: ClosetState) => {
    saveCloset(next);
    setCloset(next);
  };

  const buyItem = (item: ClosetItem) => {
    if (wallet < item.price || closet.owned.includes(item.id)) return;
    updateCloset({
      owned: [...closet.owned, item.id],
      outfit: { ...closet.outfit, [item.slot]: item.id },
      spent: closet.spent + item.price,
    });
    setTryingOn(null);
    sound.playMissionComplete();
    narrator.say(`You got the ${item.name}!`, true);
  };

  const equipItem = (slot: ClosetSlot, id: string | null) => {
    updateCloset({ ...closet, outfit: { ...closet.outfit, [slot]: id } });
  };

  const openFriends = () => {
    const engine = engineRef.current;
    if (engine?.gameState === 'playing') engine.pauseGame();
    if (engine && Object.keys(stickers).length === 0) {
      setStickers(engine.drawFriendStickers());
    }
    setIsFriendsOpen(true);
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
    <div className="app-root relative w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Isolated Three.js Canvas Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Title Screen Overlay */}
      {gameState === 'title' && !isShopOpen && (
        <TitleScreen
          onStartGame={handleStartGame}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          counts={shownCounts}
          onOpenGrownUps={() => setIsGrownUpsOpen(true)}
          onOpenShop={openShop}
          isNight={isNight}
          onToggleNight={toggleNight}
          continueChapter={continueChapter}
          onContinue={() => engineRef.current?.continueGame()}
          lakeUnlocked={lakeUnlocked}
          onGoToLake={() => engineRef.current?.startLakeSwim()}
          profiles={profiles}
          onSwitchProfile={(id) => switchProfile(id)}
          onAddProfile={() => addProfile()}
          photoCount={photos.length}
          hasStory={hasStory}
          onOpenStory={() => openStory()}
          onOpenPhotos={() => setAlbumOpen(true)}
          buddy={buddy}
          askForBuddy={!buddy && !buddyLater && !askForName}
          onPreviewBuddy={(look) => engineRef.current?.setBuddy(look)}
          onSetBuddy={(look) => {
            if (look) {
              setBuddy(look);
              saveBuddy(look);
              narrator.say(`Hi, ${look.name}! Let's swim together!`, true);
            } else {
              setBuddyLater(true);
              try {
                localStorage.setItem('whiskers_buddy_later', 'true'); // the title's Buddy button still works
              } catch {
                // ignore
              }
            }
            engineRef.current?.setBuddy(look || buddy);
          }}
          dailyMissions={dailyMissions}
          onOpenDailyMissions={openDailyMissions}
          playerName={playerName}
          askForName={askForName}
          onSetName={handleSetName}
          friendsMet={countAnimalFriends(metFriends)}
          friendsTotal={ANIMAL_FRIEND_COUNT}
          onOpenFriends={openFriends}
        />
      )}

      {/* Active Game HUD */}
      {(gameState === 'playing' || gameState === 'paused') && !inHouse && (
        <GameHUD
          tummy={tummy}
          counts={shownCounts}
          progressPercent={progressPercent}
          chapter={currentChapter}
          elapsedSeconds={elapsedSeconds}
          tipMessage={tipMessage}
          treasurePopup={treasurePopup}
          sniffReady={sniffReady}
          onPause={handlePause}
          onTakePhoto={() => void takePhoto()}
          onTriggerSonar={handleTriggerSonar}
          onSetBoost={handleSetBoost}
          onVirtualSteer={handleVirtualSteer}
          dailyMissions={dailyMissions}
          onOpenDailyMissions={openDailyMissions}
          friendsMet={countAnimalFriends(metFriends)}
          friendsTotal={ANIMAL_FRIEND_COUNT}
          friendNearby={friendNearby}
          onOpenFriends={openFriends}
          miniGame={miniGame}
          onStartHideSeek={() => engineRef.current?.startHideAndSeek()}
        />
      )}

      {debugStats && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[80] px-3 py-1.5 rounded-lg bg-black/75 text-[11px] leading-tight text-lime-300 font-mono pointer-events-none whitespace-pre">
          {`fps ${debugStats.fps}  avg ${debugStats.avgMs}ms  worst ${debugStats.worstMs}ms  ${debugStats.gpu}  ${debugStats.shadows}\nsharpness ${debugStats.pixelRatio} (changed ${debugStats.resChanges}x)  calls ${debugStats.calls}\ncamera y ${debugStats.camY}  tilt ${debugStats.pitch}°  whiskers y ${debugStats.whiskersY}\n${window.location.search}`}
        </div>
      )}

      {/* Learning moment question */}
      {gameState === 'playing' && !inHouse && learningPrompt && (
        <LearningCard prompt={learningPrompt} onAnswer={(opt) => engineRef.current?.answerLearning(opt)} />
      )}

      {/* Inside Whiskers' fish house */}
      {(gameState === 'playing' || (gameState === 'paused' && !!photoShot)) && inHouse && (
        <FishHouseRoom
          wallet={wallet}
          house={house}
          view={houseView}
          sleeping={sleeping}
          isNight={isNight}
          onView={changeHouseView}
          onBuy={buyHouseItem}
          onBedtime={goToBed}
          onExit={() => engineRef.current?.exitHouse()}
          onSay={(text) => narrator.say(text, true)}
          onTakePhoto={() => void takePhoto()}
        />
      )}

      {/* Photo mode */}
      {flash && <div className="absolute inset-0 z-[70] bg-white pointer-events-none animate-pop" />}
      {photoShot && <PhotoView url={photoShot} title="📷 Snap!" onClose={closePhoto} />}
      {albumOpen && (
        <PhotoAlbum
          photos={photos}
          onClose={() => setAlbumOpen(false)}
          onDelete={(at) => setPhotos((prev) => saveAlbum(prev.filter((p) => p.at !== at)))}
        />
      )}

      {/* Pause Menu Modal */}
      {gameState === 'paused' && !isShopOpen && !photoShot && (
        <PauseMenu
          onOpenStory={() => openStory(false)}
          onResume={handleResume}
          onRestart={handleRestart}
          onSelectChapter={handleSelectChapter}
          currentChapterId={currentChapter.id}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenGrownUps={() => setIsGrownUpsOpen(true)}
          onOpenShop={openShop}
        />
      )}

      {/* Grand Lake Victory Celebration Modal */}
      {gameState === 'victory' && !story && (
        <GrandLakeVictory
          counts={shownCounts}
          playerName={playerName}
          onFreeSwim={handleFreeSwim}
          onRestart={handleRestart}
          instant={storyShownAtLake}
          onOpenStory={hasStory || storyShownAtLake ? () => openStory(true) : undefined}
        />
      )}

      {story && (
        <Storybook
          trip={story.trip}
          playerName={playerName}
          stickers={stickers}
          photos={photos}
          finished={story.finished}
          onClose={closeStory}
        />
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
        playerName={playerName}
        onSetName={handleSetName}
        readAloud={readAloud}
        readAloudSupported={narrator.isSupported()}
        onSetReadAloud={handleSetReadAloud}
        musicOn={musicOn}
        onSetMusic={handleSetMusic}
        difficulty={difficulty}
        onSetDifficulty={handleSetDifficulty}
        profiles={profiles}
        onRemoveProfile={(id) => {
          setProfiles(removeProfile(id));
          if (user) backupOtherPlayers(user.uid);
        }}
        playersBackedUp={playersBackedUp}
        learningOn={learningOn}
        onSetLearning={(on) => {
          setLearningOn(on);
          engineRef.current?.setLearningEnabled(on);
        }}
        season={season}
        onSetSeason={(v) => {
          setSeason(v);
          engineRef.current?.setSeasonSetting(v);
        }}
      />

      {/* Dress-up shop */}
      <DressUpShop
        isOpen={isShopOpen}
        onClose={closeShop}
        wallet={wallet}
        closet={closet}
        tryingOn={tryingOn}
        onTryOn={setTryingOn}
        onBuy={buyItem}
        onEquip={equipItem}
      />

      {/* River friends sticker book */}
      <StickerBook
        isOpen={isFriendsOpen}
        onClose={() => setIsFriendsOpen(false)}
        metFriends={metFriends}
        stickers={stickers}
        playerName={playerName}
      />
    </div>
  );
}
