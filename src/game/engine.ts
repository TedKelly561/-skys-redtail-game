import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CatfishCharacter } from './catfishModel';
import {
  RiverWorld,
  CHAPTERS,
  getRiverPath,
  getRiverBedElevationAt,
  worldToRiver,
  RiverChapterInfo,
} from './worldGen';
import { ItemManager, RiverItem } from './items';
import { sound } from './audio';
import { getGameTextures } from './textures';
import { RingManager } from './rings';
import { Forest } from './forest';
import { Sky } from './sky';
import { Sparkles } from './sparkles';
import { RainbowGoal } from './rainbow';
import { BadGuys } from './badGuys';
import { Fireflies } from './fireflies';
import { DolphinRace, HideAndSeek, RaceProgress } from './minigames';
import { FIN_COLORS, Outfit, buildAccessory, loadCloset } from './closet';
import { WaterLook, addCaustics, createShorelineFoam, createWaterLook } from './water';
import { AdaptiveResolution, DistanceStreamer, downgradePhysicalMaterials } from './perf';
import { ChestManager } from './chests';
import {
  FriendKind,
  findNearbyNewFriend,
  friendName,
  loadMetFriends,
  renderFriendStickers,
  saveMetFriends,
} from './friends';
import { narrator } from './voice';
import { cheer, getPlayerName } from './profile';
import {
  DailyMissionsManager,
  DailyMissionsState,
  DailyMissionMetric,
} from './dailyMissions';

const _vec3A = new THREE.Vector3();

const NIGHT_FOG = new THREE.Color('#5b4f8f');
const NIGHT_WATER = new THREE.Color('#1d3f6e');
const RAINBOW_COLORS = ['#ff4d4d', '#ff9f1a', '#ffe14d', '#4dff88', '#4dc3ff', '#9b6bff', '#ff6bd6'];
const CONFETTI = ['#ff4d8d', '#ffd23f', '#4de3ff', '#7dff6b', '#c58bff', '#ffffff'];
const SPARKLE_COLORS: Record<string, string[]> = {
  larva: ['#ffd23f', '#ff9a5a', '#ffffff'],
  tiny_fish: ['#bff6ff', '#ffffff', '#7fdcff'],
  berry: ['#ff6fa8', '#ffd1e8', '#ffffff'],
  star: ['#ffd23f', '#fff3b0', '#ffb000'],
  smooth_stone: ['#4de3c8', '#ffffff', '#a8fff0'],
  shimmering_scale: ['#e879f9', '#7fdcff', '#ffffff'],
  lost_trinket: ['#ffcc33', '#4de3ff', '#ffffff'],
  pearl: ['#ffffff', '#cfe9ff', '#ffd1e8'],
};
const _vec3B = new THREE.Vector3();

export type GameState = 'title' | 'playing' | 'paused' | 'victory';
export type PaceMode = 'epic' | 'cozy';

export interface TreasureCounts {
  totalPoints: number;
  stars: number;
  treasuresTotal: number;
  smoothStones: number;
  shimmeringScales: number;
  lostTrinkets: number;
  riverPearls: number;
  foodEaten: number;
}

export interface StreamDepthInfo {
  playerDepthMeters: number;
  bedDepthMeters: number;
  featureLabel: string;
}

export interface GameCallbacks {
  onTummyChange: (tummy: number) => void;
  onCountsChange: (counts: TreasureCounts) => void;
  onDistanceChange: (dist: number, totalDist: number, percent: number) => void;
  onStreamDepthChange: (info: StreamDepthInfo) => void;
  onChapterChange: (chapter: RiverChapterInfo) => void;
  onStateChange: (state: GameState) => void;
  onTimeChange: (seconds: number) => void;
  onTipMessage: (message: string) => void;
  onTreasurePopup: (label: string, points: number, icon: string) => void;
  onDailyMissionsChange: (missionsState: DailyMissionsState) => void;
  onSniffReadyChange: (ready: boolean) => void;
  onFriendsChange: (met: FriendKind[]) => void;
  /** An animal not met yet is close enough to sniff (or null when none is). */
  onNearbyFriendChange: (kind: FriendKind | null) => void;
  onMiniGameChange: (info: MiniGameInfo) => void;
}

export interface MiniGameInfo {
  /** Free swimming in the lake and no game running: offer hide-and-seek. */
  canHideSeek: boolean;
  hideSeekActive: boolean;
  /** Both racers' progress (0..1) while the dolphin race is on. */
  race: RaceProgress | null;
}

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private isSoftwareGl: boolean = false;
  private frameId: number = 0;
  private isRunning: boolean = false;

  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  private player: CatfishCharacter;
  private riverWorld: RiverWorld;
  private itemManager: ItemManager;
  private ringManager: RingManager;
  private chestManager: ChestManager;
  private forest: Forest;
  private sky: Sky;
  private sparkles: Sparkles;
  private rainbow: RainbowGoal;
  private badGuys: BadGuys;
  private lastBadGuyTip: number = -999;
  /** Dress-up shop is open: the title camera moves in close on Whiskers. */
  public showcase: boolean = false;
  /** Evening mode: sunset sky, stars, moon and fireflies over the whole river. */
  public night: boolean = false;
  private fireflies!: Fireflies;
  private race!: DolphinRace;
  private hideSeek = new HideAndSeek();
  private hideSeekInviteTimer = 0;
  private lastMiniKey = '';
  private rainbowPartyTimer: number = 0;
  private fireworkTimer: number = 0;
  private victoryTime: number = 0;
  private victoryOrbit: number = 0;
  private confettiTimer: number = 0;
  private waterLook: WaterLook;
  private streamer: DistanceStreamer;
  private adaptiveResolution: AdaptiveResolution;
  public metFriends: Set<FriendKind> = loadMetFriends();
  private nearbyFriend: FriendKind | null = null;
  private friendScanTimer: number = 0;
  private lastFriendHintTime: number = -999;
  private swimSeconds: number = 0;
  private friendIntroShown: boolean = false;
  public dailyMissionsManager: DailyMissionsManager;

  public playerDistance: number = 0;
  public totalJourneyDistance: number = 2650;
  public playerLateral: number = 0;
  public playerDepth: number = -2.0;
  private lateralVelocity: number = 0;
  private depthVelocity: number = 0;
  public forwardSpeed: number = 0;
  private currentBoostBonus: number = 0;

  public tummy: number = 95;
  public counts: TreasureCounts = {
    totalPoints: 0,
    stars: 0,
    treasuresTotal: 0,
    smoothStones: 0,
    shimmeringScales: 0,
    lostTrinkets: 0,
    riverPearls: 0,
    foodEaten: 0,
  };

  public currentChapterIndex: number = 0;
  public highestChapterReached: number = 1;
  public furthestDistanceReached: number = 0;
  public gameState: GameState = 'title';
  public paceMode: PaceMode = 'cozy';
  public elapsedSeconds: number = 0;
  /** After reaching the Grand Lake, the player can keep swimming around with the family. */
  public isFreeSwim: boolean = false;

  public inputs = {
    steerLeft: false,
    steerRight: false,
    diveDown: false,
    riseUp: false,
    boost: false,
    sonarPulse: false,
  };

  public touchSteerX: number = 0;
  public touchSteerY: number = 0;
  private dragPointerId: number | null = null;
  private pointerStartX: number = 0;
  private pointerStartY: number = 0;

  private readonly SPEEDS = {
    epic: { base: 2.1, max: 3.1, boost: 4.5, hungry: 1.25 },
    cozy: { base: 4.4, max: 5.8, boost: 7.6, hungry: 2.8 },
  };

  private callbacks: GameCallbacks;
  private lastTummyRumbleTime: number = 0;
  private lastCurrentWhooshTime: number = 0;

  // Sniff: Whiskers' barbels pull nearby snacks and treasures in from far away for a moment.
  private readonly LAKE_FAR_EDGE = 3000;
  private readonly LAKE_NEAR_EDGE = 2370;
  private freeHeading: number = Math.PI;
  // Bump: a short knockback (world-space velocity) after hitting a log, caiman or piranhas.
  private bumpVelX: number = 0;
  private bumpVelZ: number = 0;
  private bumpCooldown: number = 0;
  private turnVelocity: number = 0;
  private readonly SNIFF_DURATION = 3;
  private readonly SNIFF_COOLDOWN = 6;
  private sniffActiveTimer: number = 0;
  private sniffCooldownTimer: number = 0;

  constructor(container: HTMLElement, callbacks: GameCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.clock = new THREE.Clock();

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CHAPTERS[0].fogColor);
    this.scene.fog = new THREE.FogExp2(CHAPTERS[0].fogColor, 0.008);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    // The white studio environment is only meant for soft reflections. At full strength it
    // flooded every surface with white and washed out the colors, so keep it subtle and let
    // the sun and sky lights do the work.
    this.scene.environmentIntensity = 0.3;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(
      58,
      container.clientWidth / container.clientHeight,
      0.2,
      210
    );
    this.fitCameraToAspect();

    this.hemiLight = new THREE.HemisphereLight(0xf0fcff, 0x5c8065, 1.7);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff9e6, 2.2);
    this.dirLight.position.set(25, 48, 15);
    this.dirLight.castShadow = !this.isSoftwareGl;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 120;
    const d = 32;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    this.player = new CatfishCharacter();
    this.scene.add(this.player.group);

    this.riverWorld = new RiverWorld(this.scene);
    this.itemManager = new ItemManager(this.scene);
    this.ringManager = new RingManager(this.scene);
    this.chestManager = new ChestManager(this.scene);
    this.forest = new Forest(this.scene);
    this.sky = new Sky(this.scene, new THREE.Vector3(25, 48, 15));
    this.sparkles = new Sparkles(this.scene);
    this.rainbow = new RainbowGoal(this.scene);
    this.badGuys = new BadGuys(this.scene);
    this.fireflies = new Fireflies(this.scene);
    this.race = new DolphinRace(this.scene, this.riverWorld.dolphins[0]);
    try {
      this.night = localStorage.getItem('whiskers_night') === 'true';
    } catch {
      // ignore
    }
    this.sky.setColors(CHAPTERS[0].fogColor);

    // Realistic water surface, caustic light on the riverbed and shoreline foam.
    this.waterLook = createWaterLook();
    const oldWaterMat = this.riverWorld.waterMesh.material as THREE.Material;
    this.riverWorld.waterMesh.material = this.waterLook.material;
    this.riverWorld.waterMesh.renderOrder = 1;
    oldWaterMat.dispose();
    addCaustics(this.riverWorld.riverBedMaterial, this.waterLook.uniforms.uTime);
    this.waterLook.uniforms.uSkyHorizon.value.set(CHAPTERS[0].fogColor);
    this.waterLook.uniforms.uSkyZenith.value.copy(this.sky.zenithColor);
    this.scene.add(createShorelineFoam(this.waterLook.uniforms.uTime));

    // Speed: cheaper materials everywhere except the water, and only the nearby river kept in
    // the scene (radius in meters around Whiskers).
    downgradePhysicalMaterials(this.scene, new Set([this.riverWorld.waterMesh.material as THREE.Material]));
    this.streamer = new DistanceStreamer();
    this.streamer.addChildrenOf(this.forest.group, 190);
    this.streamer.addChildrenOf(this.riverWorld.lilyPadsGroup, 160);
    this.streamer.addChildrenOf(this.riverWorld.hollowLogsGroup, 160);
    this.streamer.addChildrenOf(this.riverWorld.currentsGroup, 140);
    this.streamer.addChildrenOf(this.riverWorld.animalsGroup, 125);
    this.streamer.addChildrenOf(this.riverWorld.grandLakeCelebrationGroup, 230);
    this.streamer.addChildrenOf(this.itemManager.itemGroup, 85);
    this.streamer.addChildrenOf(this.ringManager.group, 140);
    this.streamer.addChildrenOf(this.chestManager.group, 170);
    this.streamer.addChildrenOf(this.badGuys.caimanGroup, 140);
    this.streamer.addChildrenOf(this.badGuys.piranhaGroup, 140);
    this.streamer.addChildrenOf(this.race.group, 170);
    this.applyOutfit(loadCloset().outfit);
    this.applyChapterLook(CHAPTERS[0], 0);
    this.adaptiveResolution = new AdaptiveResolution(
      this.renderer,
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );

    // Keep the riverbed crisp when viewed at a low angle.
    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const textures = getGameTextures();
    [textures.riverbedAlbedo, textures.riverbedBump].forEach((t) => {
      t.anisotropy = maxAniso;
      t.needsUpdate = true;
    });
    this.dailyMissionsManager = new DailyMissionsManager();

    this.loadLocalProgress();
    this.callbacks.onDailyMissionsChange(this.dailyMissionsManager.getState());
    this.callbacks.onFriendsChange([...this.metFriends]);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('resize', this.onResize);

    this.isRunning = true;
    this.startLoop();
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.gameState !== 'playing' || this.dragPointerId !== null) return;
    this.dragPointerId = e.pointerId;
    this.pointerStartX = e.clientX;
    this.pointerStartY = e.clientY;
  };

  // Only the finger that started the drag steers, so holding Boost with another finger
  // doesn't yank Whiskers sideways.
  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.dragPointerId || this.gameState !== 'playing') return;
    const dx = (e.clientX - this.pointerStartX) / 90;
    const dy = -(e.clientY - this.pointerStartY) / 90;
    this.touchSteerX = THREE.MathUtils.clamp(dx, -1, 1);
    this.touchSteerY = THREE.MathUtils.clamp(dy, -1, 1);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.dragPointerId) {
      this.dragPointerId = null;
      this.touchSteerX = 0;
      this.touchSteerY = 0;
    }
  };

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.fitCameraToAspect();
    this.renderer.setSize(width, height);
  };

  /**
   * On tall phone/tablet screens a fixed vertical field of view leaves a very narrow
   * slice of river visible. Widen it so roughly the same amount of river shows side to side.
   */
  private fitCameraToAspect() {
    const baseFov = 58;
    const targetHorizontalFov = THREE.MathUtils.degToRad(48);
    const neededFov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(targetHorizontalFov / 2) / this.camera.aspect)
    );
    this.camera.fov = THREE.MathUtils.clamp(neededFov, baseFov, 80);
    this.camera.updateProjectionMatrix();
  }

  private loadLocalProgress() {
    try {
      const savedPace = localStorage.getItem('whiskers_pace_mode');
      if (savedPace === 'cozy' || savedPace === 'epic') {
        this.paceMode = savedPace;
      }
      const savedCounts = localStorage.getItem('whiskers_treasure_counts');
      if (savedCounts) {
        const parsed = JSON.parse(savedCounts);
        this.counts = {
          totalPoints: Number(parsed.totalPoints) || 0,
          stars: Number(parsed.stars) || 0,
          treasuresTotal: Number(parsed.treasuresTotal) || 0,
          smoothStones: Number(parsed.smoothStones) || 0,
          shimmeringScales: Number(parsed.shimmeringScales) || 0,
          lostTrinkets: Number(parsed.lostTrinkets) || 0,
          riverPearls: Number(parsed.riverPearls) || 0,
          foodEaten: Number(parsed.foodEaten) || 0,
        };
        this.callbacks.onCountsChange({ ...this.counts });
      }
    } catch {
      // ignore
    }
  }

  private saveLocalProgress() {
    try {
      localStorage.setItem('whiskers_treasure_counts', JSON.stringify(this.counts));
    } catch {
      // ignore
    }
  }

  public applyCloudProgress(cloud: {
    totalPoints: number;
    starsCollected: number;
    treasuresCollected: number;
    foodEaten: number;
    furthestDistance: number;
    highestChapter: number;
    smoothStones: number;
    lostTrinkets: number;
    shimmeringScales: number;
    riverPearls: number;
  }) {
    this.counts = {
      totalPoints: Math.max(this.counts.totalPoints, cloud.totalPoints),
      stars: Math.max(this.counts.stars, cloud.starsCollected),
      treasuresTotal: Math.max(this.counts.treasuresTotal, cloud.treasuresCollected),
      smoothStones: Math.max(this.counts.smoothStones, cloud.smoothStones),
      shimmeringScales: Math.max(this.counts.shimmeringScales, cloud.shimmeringScales),
      lostTrinkets: Math.max(this.counts.lostTrinkets, cloud.lostTrinkets),
      riverPearls: Math.max(this.counts.riverPearls, cloud.riverPearls),
      foodEaten: Math.max(this.counts.foodEaten, cloud.foodEaten),
    };
    this.furthestDistanceReached = Math.max(this.furthestDistanceReached, cloud.furthestDistance);
    this.highestChapterReached = Math.max(this.highestChapterReached, cloud.highestChapter);
    this.saveLocalProgress();
    this.callbacks.onCountsChange({ ...this.counts });
  }

  public setPaceMode(mode: PaceMode) {
    this.paceMode = mode;
    try {
      localStorage.setItem('whiskers_pace_mode', mode);
    } catch {
      // ignore
    }
  }

  public startGame(startAtChapterIndex: number = 0) {
    this.isFreeSwim = false;
    this.riverWorld.setFamilyFollow(null);
    this.player.setRainbow(false);
    this.rainbow.reset();
    this.badGuys.reset();
    this.race.reset();
    this.hideSeek.stop(this.riverWorld);
    this.hideSeekInviteTimer = 0;
    this.emitMiniGame(null);
    this.rainbowPartyTimer = 0;
    this.gameState = 'playing';
    this.callbacks.onStateChange('playing');
    sound.startRiverAmbience();

    if (startAtChapterIndex > 0 && startAtChapterIndex < CHAPTERS.length) {
      this.playerDistance = CHAPTERS[startAtChapterIndex].startDist + 15;
    } else {
      this.playerDistance = 15;
    }

    this.playerLateral = 0;
    this.playerDepth = -2.0;
    this.lateralVelocity = 0;
    this.depthVelocity = 0;
    this.tummy = 95;
    this.callbacks.onTummyChange(this.tummy);
    this.updateChapter(true);

    this.sniffActiveTimer = 0;
    this.sniffCooldownTimer = 0;
    this.callbacks.onSniffReadyChange(true);
    this.setNearbyFriend(null);
    this.swimSeconds = 0;
    this.friendIntroShown = false;
    // Every swim starts with a fresh river: snacks, treasures, rings and chests.
    this.itemManager.resetItems();
    this.ringManager.reset();
    this.chestManager.reset();
    const name = getPlayerName();
    this.callbacks.onTipMessage(
      name ? `Let's go, ${name}! Swim to the Grand Lake!` : 'Swim down the river to the Grand Lake!'
    );
  }

  public pauseGame() {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
      this.callbacks.onStateChange('paused');
    }
  }

  public resumeGame() {
    if (this.gameState === 'paused') {
      this.gameState = 'playing';
      this.callbacks.onStateChange('playing');
      sound.startRiverAmbience();
    }
  }

  public restartJourney() {
    this.playerDistance = 15;
    this.playerLateral = 0;
    this.playerDepth = -2.0;
    this.lateralVelocity = 0;
    this.depthVelocity = 0;
    this.tummy = 95;
    this.elapsedSeconds = 0;
    this.startGame(0);
  }

  public startFreeSwim() {
    if (this.gameState !== 'victory') return;
    this.isFreeSwim = true;
    this.freeHeading = this.player.group.rotation.y;
    this.turnVelocity = 0;
    this.gameState = 'playing';
    this.callbacks.onStateChange('playing');
    this.callbacks.onTipMessage('Swim anywhere! Turn left and right to explore.');
    this.hideSeekInviteTimer = 7;
    this.emitMiniGame(null);
  }

  public triggerSonarPulse() {
    if (this.gameState !== 'playing') return;
    this.tryMeetNearbyFriend();
    if (this.hideSeek.active) {
      this.hideSeek.showDirection(this.player.group.position, this.sparkles);
      narrator.say('Pip is that way!', true);
    }
    if (this.sniffCooldownTimer > 0) return;
    this.sniffActiveTimer = this.SNIFF_DURATION;
    this.sniffCooldownTimer = this.SNIFF_COOLDOWN;
    this.callbacks.onSniffReadyChange(false);
    this.player.pulseBarbelSonar();
    sound.playBarbelSense();
    const res = this.dailyMissionsManager.recordEvent(['use_sonar'], 1);
    this.handleDailyMissionResult(res);
  }

  /** Dress Whiskers in the hat, glasses and fin color from the closet. */
  public applyOutfit(outfit: Outfit) {
    this.player.setAccessory('hat', outfit.hat ? buildAccessory(outfit.hat) : null);
    this.player.setAccessory('glasses', outfit.glasses ? buildAccessory(outfit.glasses) : null);
    this.player.setFinColor(
      outfit.color === 'rainbow-fins' ? 'rainbow' : outfit.color ? FIN_COLORS[outfit.color] ?? null : null
    );
  }

  /** Pictures of each friend drawn from their in-game models, for the sticker book. */
  public drawFriendStickers() {
    return renderFriendStickers([
      ...this.riverWorld.friendSpots,
      { kind: 'rainbow', object: this.rainbow.pearl },
    ]);
  }

  private setNearbyFriend(kind: FriendKind | null) {
    if (kind === this.nearbyFriend) return;
    this.nearbyFriend = kind;
    this.callbacks.onNearbyFriendChange(kind);
  }

  private meetFriend(kind: FriendKind, announce: boolean) {
    if (this.metFriends.has(kind)) return;
    this.metFriends.add(kind);
    saveMetFriends(this.metFriends);
    this.callbacks.onFriendsChange([...this.metFriends]);
    if (!announce) return;
    const name = friendName(kind);
    this.counts.totalPoints += 20;
    this.saveLocalProgress();
    this.callbacks.onCountsChange({ ...this.counts });
    sound.playMissionComplete();
    this.callbacks.onTreasurePopup(`Hi, ${name}!`, 20, '👋');
    this.sparkles.burst(this.player.group.position, ['#ff8fc0', '#ffffff', '#ffd1e8'], 26, 3);
    narrator.say(`Hi, ${name}! You made a new friend!`, true);
  }

  private tryMeetNearbyFriend() {
    const kind = findNearbyNewFriend(
      this.riverWorld.friendSpots,
      this.metFriends,
      this.player.group.position
    );
    if (kind) {
      this.meetFriend(kind, true);
      this.setNearbyFriend(null);
    }
  }

  public startNextDailyMissionBonusSet() {
    const nextState = this.dailyMissionsManager.startNextBonusSet();
    this.callbacks.onDailyMissionsChange(nextState);
    this.callbacks.onTipMessage('3 new missions!');
  }

  private handleDailyMissionResult(res: {
    completedMissions: { title: string; rewardPoints: number; icon: string }[];
    allClearBonusAwarded: boolean;
    totalBonusPointsEarned: number;
    updatedState: DailyMissionsState;
  } | null) {
    if (!res) return;
    this.callbacks.onDailyMissionsChange(res.updatedState);

    if (res.totalBonusPointsEarned > 0) {
      this.counts.totalPoints += res.totalBonusPointsEarned;
      this.saveLocalProgress();
      this.callbacks.onCountsChange({ ...this.counts });
      sound.playMissionComplete();

      if (res.allClearBonusAwarded) {
        this.callbacks.onTreasurePopup('All missions done!', res.totalBonusPointsEarned, '🎁');
        narrator.say(cheer('You did all your missions'), true);
      } else if (res.completedMissions.length > 0) {
        const m = res.completedMissions[0];
        this.callbacks.onTreasurePopup('Mission done!', m.rewardPoints, m.icon);
        narrator.say(cheer('Mission done. Great job'), true);
      }
    }
  }

  private startLoop() {
    const tick = () => {
      if (!this.isRunning) return;

      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);

      if (this.gameState === 'playing') {
        this.elapsedSeconds += dt;
        this.callbacks.onTimeChange(Math.floor(this.elapsedSeconds));
        this.updateGame(dt);
      } else if (this.gameState === 'title') {
        this.updateTitleMode(dt);
      } else if (this.gameState === 'victory') {
        this.updateVictoryMode(dt);
      }

      this.forest.update(dt);
      this.waterLook.uniforms.uTime.value += dt;
      this.streamer.update(dt, this.player.group.position);
      this.adaptiveResolution.update(rawDt);
      this.sky.update(dt, this.camera.position);
      this.rainbow.update(dt);
      this.fireflies.update(
        dt,
        this.player.group.position,
        this.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)))
      );
      this.updateRainbowParty(dt);
      this.sparkles.update(
        dt,
        this.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)))
      );
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        window.setTimeout(() => {
          this.frameId = requestAnimationFrame(tick);
        }, 30);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  /** Free swimming in the Grand Lake: Whiskers keeps cruising and turns to go anywhere. */
  private updateLakeSwim(dt: number, steerX: number, diveY: number, isBoosting: boolean) {
    const speedCfg = this.SPEEDS[this.paceMode];
    this.swimSeconds += dt;
    this.turnVelocity = THREE.MathUtils.damp(this.turnVelocity, -steerX * 2.0, 6, dt);
    this.freeHeading += this.turnVelocity * dt;

    const target = this.tummy <= 0 ? speedCfg.hungry : isBoosting ? speedCfg.boost : speedCfg.base * 0.85;
    this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed, target, 3.2, dt);
    const fx = Math.sin(this.freeHeading);
    const fz = Math.cos(this.freeHeading);
    const p = this.player.group.position;
    const step = this.forwardSpeed * dt;
    const nx = p.x + fx * step + this.bumpVelX * dt;
    const nz = p.z + fz * step + this.bumpVelZ * dt;
    const next = worldToRiver(nx, nz);
    const inside =
      next.distance > this.LAKE_NEAR_EDGE &&
      next.distance < this.LAKE_FAR_EDGE &&
      getRiverBedElevationAt(next.distance, next.lateral) < -1.3;
    let x = p.x;
    let z = p.z;
    if (inside) {
      x = nx;
      z = nz;
      this.playerDistance = next.distance;
      this.playerLateral = next.lateral;
      const missionRes = this.dailyMissionsManager.recordSwimDistanceDelta(step);
      if (missionRes) this.handleDailyMissionResult(missionRes);
    } else {
      // Reached the shore: turn gently back toward open water.
      const center = getRiverPath(THREE.MathUtils.clamp(this.playerDistance, 2480, 2880)).position;
      const want = Math.atan2(center.x - p.x, center.z - p.z);
      const diff = Math.atan2(Math.sin(want - this.freeHeading), Math.cos(want - this.freeHeading));
      this.freeHeading += diff * Math.min(1, dt * 1.8);
    }

    const bed = getRiverBedElevationAt(this.playerDistance, this.playerLateral);
    this.depthVelocity = THREE.MathUtils.damp(this.depthVelocity, diveY * 5.2, 6.5, dt);
    this.playerDepth = THREE.MathUtils.clamp(
      this.playerDepth + this.depthVelocity * dt,
      Math.min(-0.85, bed + 0.45),
      -0.38
    );

    this.player.group.position.set(x, this.playerDepth, z);
    this.player.group.rotation.y = this.freeHeading;
    this.player.update(dt, this.forwardSpeed, steerX, diveY);

    this.dirLight.position.set(x + 25, 48, z + 15);
    this.dirLight.target.position.set(x, this.playerDepth, z);
    this.dirLight.target.updateMatrixWorld();

    _vec3A.set(x - fx * 6.2, Math.max(0.1, this.playerDepth + 3.1), z - fz * 6.2);
    this.camera.position.lerp(_vec3A, Math.min(1.0, dt * 4));
    _vec3B.set(x + fx * 4.8, this.playerDepth + 0.25, z + fz * 4.8);
    this.camera.lookAt(_vec3B);
  }

  private updateVictoryMode(dt: number) {
    this.victoryTime += dt;
    this.victoryOrbit += dt * 0.3;
    const p = this.player.group.position;
    this.player.update(dt, 1.2, Math.sin(this.victoryTime * 0.8) * 0.2, 0);
    const radius = 8;
    _vec3A.set(
      p.x + Math.sin(this.victoryOrbit) * radius,
      Math.max(0.7, p.y + 3.0),
      p.z + Math.cos(this.victoryOrbit) * radius
    );
    this.camera.position.lerp(_vec3A, Math.min(1, dt * 2));
    this.camera.lookAt(p.x, p.y + 0.3, p.z);
    this.riverWorld.update(dt, this.playerDistance);

    this.confettiTimer -= dt;
    if (this.confettiTimer <= 0) {
      this.confettiTimer = 0.2;
      _vec3B.set(p.x + (Math.random() - 0.5) * 7, p.y + 0.5 + Math.random() * 3, p.z + (Math.random() - 0.5) * 7);
      this.sparkles.burst(_vec3B, CONFETTI, 9, 2.2, 0.6);
    }
  }

  private updateTitleMode(dt: number) {
    const time = this.clock.getElapsedTime();
    const dist = 60 + Math.sin(time * 0.2) * 12;
    const { position, tangent } = getRiverPath(dist);

    this.player.group.position.set(position.x, -1.7 + Math.sin(time * 0.8) * 0.22, position.z);
    this.player.group.rotation.y = Math.atan2(tangent.x, tangent.z);
    this.player.update(dt, 1.4, Math.sin(time * 0.7) * 0.25, 0);

    const camAngle = time * 0.22;
    const p = this.player.group.position;
    if (this.showcase) {
      // Dress-up: close, slowly circling, with Whiskers in the upper part of the screen
      // (the shop panel covers the bottom).
      _vec3A.set(p.x + Math.sin(camAngle) * 3.6, p.y + 0.9, p.z + Math.cos(camAngle) * 3.6);
      this.camera.position.lerp(_vec3A, Math.min(1, dt * 3));
      this.camera.lookAt(p.x, p.y - 0.75, p.z);
    } else {
      this.camera.position.set(
        position.x + Math.sin(camAngle) * 7.2,
        0.5 + Math.sin(time * 0.4) * 0.35,
        position.z + Math.cos(camAngle) * 7.2
      );
      this.camera.lookAt(p);
    }

    this.riverWorld.update(dt, dist);
  }

  private updateGame(dt: number) {
    const speedCfg = this.SPEEDS[this.paceMode];

    let steerX = 0;
    if (this.inputs.steerLeft) steerX -= 1;
    if (this.inputs.steerRight) steerX += 1;
    if (Math.abs(this.touchSteerX) > 0.05) steerX = this.touchSteerX;

    let diveY = 0;
    if (this.inputs.riseUp) diveY += 1;
    if (this.inputs.diveDown) diveY -= 1;
    if (Math.abs(this.touchSteerY) > 0.05) diveY = this.touchSteerY;

    const isBoosting = this.inputs.boost && this.tummy > 8;
    this.player.isBoosting = isBoosting;

    if (this.bumpCooldown > 0) this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    const bumpDecay = Math.exp(-dt * 3.5);
    this.bumpVelX *= bumpDecay;
    this.bumpVelZ *= bumpDecay;
    if (Math.abs(this.bumpVelX) + Math.abs(this.bumpVelZ) < 0.05) {
      this.bumpVelX = 0;
      this.bumpVelZ = 0;
    }

    if (this.inputs.sonarPulse) {
      this.triggerSonarPulse();
      this.inputs.sonarPulse = false;
    }
    this.sniffActiveTimer = Math.max(0, this.sniffActiveTimer - dt);
    if (this.sniffCooldownTimer > 0) {
      this.sniffCooldownTimer = Math.max(0, this.sniffCooldownTimer - dt);
      if (this.sniffCooldownTimer === 0) this.callbacks.onSniffReadyChange(true);
    }

    const activeSwimEffort = Math.hypot(steerX, diveY) * 0.38;
    const boostEffort = isBoosting ? 0.75 : 0;
    const baseMetabolism = 0.32;
    const totalHungerDrain = (baseMetabolism + activeSwimEffort + boostEffort) * dt;

    this.tummy = Math.max(0, this.tummy - totalHungerDrain);
    this.callbacks.onTummyChange(Math.round(this.tummy));

    if (this.tummy < 20 && this.elapsedSeconds - this.lastTummyRumbleTime > 28) {
      sound.playTummyRumble();
      this.lastTummyRumbleTime = this.elapsedSeconds;
      this.callbacks.onTipMessage('Whiskers is hungry! Eat some snacks!');
    }

    this.currentBoostBonus = THREE.MathUtils.damp(this.currentBoostBonus, 0, 2.5, dt);
    let currentSwirlLateral = 0;

    for (let i = 0; i < this.riverWorld.currentZones.length; i++) {
      const cz = this.riverWorld.currentZones[i];
      if (Math.abs(this.playerDistance - cz.distance) < cz.length * 0.6) {
        const latDiff = Math.abs(this.playerLateral - cz.lateralOffset);
        if (latDiff < cz.radius) {
          this.currentBoostBonus = cz.boostSpeed;
          currentSwirlLateral = cz.swirlPush;
          if (this.elapsedSeconds - this.lastCurrentWhooshTime > 3.5) {
            this.lastCurrentWhooshTime = this.elapsedSeconds;
            sound.playCurrentBoost();
            this.callbacks.onTipMessage('Whoosh!');
          }
        }
      }
    }

    const {
      position: riverPos,
      tangent,
      normal,
      width,
      featureType,
      featureLabel,
    } = getRiverPath(this.playerDistance);

    // Shallow riffles have a brisker natural flow (+0.45 m/s) compared to calm deep pools
    const geomorphFlowDelta = featureType === 'riffle' ? 0.45 : featureType === 'pool' ? -0.15 : 0;

    let targetSpeed = speedCfg.base + geomorphFlowDelta;
    if (this.tummy <= 0) {
      targetSpeed = speedCfg.hungry;
    } else if (isBoosting) {
      targetSpeed = speedCfg.boost + geomorphFlowDelta;
    } else if (this.tummy > 75) {
      targetSpeed = speedCfg.max + geomorphFlowDelta;
    }
    targetSpeed += this.currentBoostBonus;

    const prevDistance = this.playerDistance;
    if (this.isFreeSwim) {
      // Grand Lake: swim anywhere (left/right turns Whiskers all the way around).
      this.updateLakeSwim(dt, steerX, diveY, isBoosting);
    } else {
      this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed, targetSpeed, 3.2, dt);
      const distDelta = this.forwardSpeed * dt;
      this.playerDistance += distDelta;
      if (this.bumpVelX !== 0 || this.bumpVelZ !== 0) {
        this.playerDistance += (this.bumpVelX * tangent.x + this.bumpVelZ * tangent.z) * dt;
        this.playerLateral += (this.bumpVelX * normal.x + this.bumpVelZ * normal.z) * dt;
      }
      this.swimSeconds += dt;
      // The lake ends a little past here; keep Whiskers inside the world while free swimming.
      if (this.playerDistance > this.LAKE_FAR_EDGE) {
        this.playerDistance = this.LAKE_FAR_EDGE;
      }

      const swimMissionRes = this.dailyMissionsManager.recordSwimDistanceDelta(distDelta);
      if (swimMissionRes) {
        this.handleDailyMissionResult(swimMissionRes);
      }

      if (this.playerDistance > this.furthestDistanceReached) {
        this.furthestDistanceReached = Math.round(this.playerDistance);
      }

      const maxLateral = width / 2 - 2.2;
      const targetLatVel = steerX * 9.2 + currentSwirlLateral;
      this.lateralVelocity = THREE.MathUtils.damp(this.lateralVelocity, targetLatVel, 6.5, dt);
      this.playerLateral += this.lateralVelocity * dt;
      this.playerLateral = THREE.MathUtils.clamp(this.playerLateral, -maxLateral, maxLateral);

      // Dynamic organic riverbed floor elevation at Whiskers' exact (distance, lateral) coordinate!
      const localBedY = getRiverBedElevationAt(this.playerDistance, this.playerLateral);
      const minAllowedDepth = Math.min(-0.85, localBedY + 0.45);

      const targetDepthVel = diveY * 5.2;
      this.depthVelocity = THREE.MathUtils.damp(this.depthVelocity, targetDepthVel, 6.5, dt);
      this.playerDepth += this.depthVelocity * dt;
      this.playerDepth = THREE.MathUtils.clamp(this.playerDepth, minAllowedDepth, -0.38);

      this.callbacks.onStreamDepthChange({
        playerDepthMeters: Number(Math.abs(this.playerDepth).toFixed(1)),
        bedDepthMeters: Number(Math.abs(localBedY).toFixed(1)),
        featureLabel,
      });

      for (let i = 0; i < this.riverWorld.logObstacles.length; i++) {
        const log = this.riverWorld.logObstacles[i];
        if (Math.abs(this.playerDistance - log.distance) < log.length * 0.45) {
          const dy = this.playerDepth - log.y;
          const dx = this.playerLateral - log.lateralOffset;
          const distFromLogCenter = Math.hypot(dx, dy);

          if (log.isHollow) {
            if (distFromLogCenter > 1.3 && distFromLogCenter < 1.95) {
              this.playerDepth = THREE.MathUtils.lerp(this.playerDepth, log.y, dt * 4);
            }
          }
        }
      }

      if (this.playerDepth >= -0.48 && diveY > 0 && Math.random() < 0.05) {
        sound.playWaterHop();
      }

      const worldX = riverPos.x + normal.x * this.playerLateral;
      const worldY = this.playerDepth;
      const worldZ = riverPos.z + normal.z * this.playerLateral;

      this.player.group.position.set(worldX, worldY, worldZ);
      this.checkLogBumps();

      const velX = tangent.x * this.forwardSpeed + normal.x * this.lateralVelocity * 0.45;
      const velZ = tangent.z * this.forwardSpeed + normal.z * this.lateralVelocity * 0.45;
      this.player.group.rotation.y = Math.atan2(velX, velZ);

      this.player.update(dt, this.forwardSpeed, steerX, diveY);

      this.dirLight.position.set(worldX + 25, 48, worldZ + 15);
      this.dirLight.target.position.set(worldX, worldY, worldZ);
      this.dirLight.target.updateMatrixWorld();

      const camOffsetDist = 6.2;
      const camHeight = 3.1;
      _vec3A.set(
        worldX - tangent.x * camOffsetDist + normal.x * (steerX * 0.6),
        Math.max(0.1, worldY + camHeight),
        worldZ - tangent.z * camOffsetDist + normal.z * (steerX * 0.6)
      );
      this.camera.position.lerp(_vec3A, Math.min(1.0, dt * 5.2));

      _vec3B.set(worldX + tangent.x * 4.8, worldY + 0.25, worldZ + tangent.z * 4.8);
      this.camera.lookAt(_vec3B);
    }

    this.riverWorld.update(dt, this.playerDistance);
    this.updateRingsChestsAndFriends(dt, prevDistance);
    this.updateBadGuys(dt, isBoosting, speedCfg.boost * 0.8);
    this.updateMiniGames(dt, prevDistance, (speedCfg.max + speedCfg.boost) / 2);

    this.itemManager.updateAndCheckCollisions(
      dt,
      this.player.group.position,
      this.sniffActiveTimer > 0 ? 10 : 3.5,
      (item: RiverItem) => {
        this.counts.totalPoints += item.pointsValue;

        if (item.hungerRestore > 0) {
          this.tummy = Math.min(100, this.tummy + item.hungerRestore);
          this.counts.foodEaten += 1;
          this.callbacks.onTummyChange(Math.round(this.tummy));

          const icon =
            item.type === 'tiny_fish' ? '🐟' : item.type === 'berry' ? '🍒' : '🐛';
          this.callbacks.onTreasurePopup('Yum!', item.pointsValue, icon);
        } else if (item.type === 'star') {
          this.counts.stars += 1;
          this.callbacks.onTreasurePopup('Star!', item.pointsValue, '⭐');
        } else {
          this.counts.treasuresTotal += 1;
          let icon = '💎';
          if (item.type === 'smooth_stone') {
            this.counts.smoothStones += 1;
            icon = '🪨';
          } else if (item.type === 'shimmering_scale') {
            this.counts.shimmeringScales += 1;
            icon = '✨';
          } else if (item.type === 'lost_trinket') {
            this.counts.lostTrinkets += 1;
            icon = '🧭';
          } else if (item.type === 'pearl') {
            this.counts.riverPearls += 1;
            icon = '🦪';
          }
          this.callbacks.onTreasurePopup('Treasure!', item.pointsValue, icon);
        }

        this.saveLocalProgress();
        this.callbacks.onCountsChange({ ...this.counts });

        this.sparkles.burst(item.group.position, SPARKLE_COLORS[item.type] ?? SPARKLE_COLORS.star);

        // Track Daily Missions for collected item
        const missionMetrics: DailyMissionMetric[] = [];
        if (item.type === 'larva') {
          missionMetrics.push('eat_larva', 'eat_any_food');
        } else if (item.type === 'tiny_fish') {
          missionMetrics.push('eat_minnow', 'eat_any_food');
        } else if (item.type === 'berry') {
          missionMetrics.push('eat_any_food');
        } else if (item.type === 'star') {
          missionMetrics.push('collect_star');
        } else if (item.type === 'smooth_stone') {
          missionMetrics.push('collect_any_treasure', 'collect_smooth_stone');
        } else if (item.type === 'shimmering_scale' || item.type === 'pearl') {
          missionMetrics.push('collect_any_treasure', 'collect_scale_or_pearl');
        } else if (item.type === 'lost_trinket') {
          missionMetrics.push('collect_any_treasure');
        }

        if (missionMetrics.length > 0) {
          const missionRes = this.dailyMissionsManager.recordEvent(missionMetrics, 1);
          this.handleDailyMissionResult(missionRes);
        }
      }
    );

    const percent = Math.min(
      100,
      Math.round((this.playerDistance / this.totalJourneyDistance) * 100)
    );
    this.callbacks.onDistanceChange(
      Math.round(this.playerDistance),
      this.totalJourneyDistance,
      percent
    );

    this.updateChapter(false);

    if (this.playerDistance >= 2420 && this.gameState === 'playing' && !this.isFreeSwim) {
      this.triggerGrandLakeCelebration();
    }
  }

  /**
   * Cartoon bump: Whiskers bounces back from `from` (and a little backward from where he was
   * swimming), with a boing, a wobble and dizzy stars. `slideDir` adds a sideways push, used to
   * slide him toward the nearer end of a log so he doesn't get stuck against it.
   */
  private bump(from: THREE.Vector3, slideX = 0, slideZ = 0, rise = 0) {
    if (this.bumpCooldown > 0) return;
    this.bumpCooldown = 0.7;
    const p = this.player.group.position;
    let ax = p.x - from.x;
    let az = p.z - from.z;
    const len = Math.hypot(ax, az) || 1;
    ax /= len;
    az /= len;
    const heading = this.player.group.rotation.y;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    this.bumpVelX = ax * 5 - fx * 3 + slideX * 7;
    this.bumpVelZ = az * 5 - fz * 3 + slideZ * 7;
    this.forwardSpeed *= 0.2;
    if (rise !== 0) this.depthVelocity = rise;
    this.player.bump();
    sound.playBoing();
    _vec3B.set((p.x + from.x) / 2, p.y, (p.z + from.z) / 2);
    this.sparkles.burst(_vec3B, ['#ffffff', '#ffd23f', '#bff6ff'], 14, 3, 0.4);
  }

  /** Solid logs lie across the river: bump off them instead of swimming through. */
  private checkLogBumps() {
    if (this.bumpCooldown > 0) return;
    const p = this.player.group.position;
    const logs = this.riverWorld.logObstacles;
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log.isHollow || Math.abs(this.playerDistance - log.distance) > 8) continue;
      // Solid log axis is the group's local X: (cos y, 0, -sin y).
      const ax = Math.cos(log.rotationY);
      const az = -Math.sin(log.rotationY);
      const half = log.length / 2;
      const vx = p.x - log.position.x;
      const vz = p.z - log.position.z;
      const t = THREE.MathUtils.clamp(vx * ax + vz * az, -half, half);
      const cx = log.position.x + ax * t;
      const cz = log.position.z + az * t;
      const d = Math.hypot(p.x - cx, p.y - log.y, p.z - cz);
      if (d < log.radius + 0.45) {
        // Boing up and over (or under, if he hit it from below), sliding toward the nearer end.
        const side = t >= 0 ? 1 : -1;
        _vec3A.set(cx, log.y, cz);
        this.bump(_vec3A, ax * side, az * side, p.y >= log.y - 0.3 ? 12.5 : -9);
        return;
      }
    }
  }

  /** Hide-and-seek with Pip (Grand Lake free swim). */
  public startHideAndSeek() {
    if (!this.isFreeSwim || this.hideSeek.active) return;
    if (this.hideSeek.start(this.riverWorld, this.player.group.position)) {
      this.hideSeekInviteTimer = 0;
      this.callbacks.onTipMessage('Pip is hiding! Find him! Sniff shows the way.');
      sound.playMilestone();
      this.emitMiniGame(null);
    }
  }

  private emitMiniGame(race: RaceProgress | null) {
    const info: MiniGameInfo = {
      canHideSeek: this.isFreeSwim && !this.hideSeek.active,
      hideSeekActive: this.hideSeek.active,
      race: race ? { whiskers: Math.round(race.whiskers * 50) / 50, dolphin: Math.round(race.dolphin * 50) / 50 } : null,
    };
    const key = JSON.stringify(info);
    if (key !== this.lastMiniKey) {
      this.lastMiniKey = key;
      this.callbacks.onMiniGameChange(info);
    }
  }

  private rewardStars(stars: number, points: number) {
    this.counts.stars += stars;
    this.counts.totalPoints += points;
    this.saveLocalProgress();
    this.callbacks.onCountsChange({ ...this.counts });
  }

  private updateMiniGames(dt: number, prevDistance: number, dolphinSpeed: number) {
    const r = this.race.update(dt, prevDistance, this.playerDistance, this.playerLateral, dolphinSpeed);
    if (r.event === 'start') {
      this.callbacks.onTipMessage('Race the dolphin to the checkered flags! Zoom!');
      sound.playMilestone();
      narrator.say('Ready, set, go! Race the dolphin!', true);
    } else if (r.event === 'win') {
      this.rewardStars(10, 50);
      sound.playMissionComplete();
      this.callbacks.onTreasurePopup('You won the race!', 10, '🏆');
      narrator.say(cheer('You won the race'), true);
      this.sparkles.burst(this.player.group.position, RAINBOW_COLORS, 50, 4.5, 1.5);
    } else if (r.event === 'lose') {
      this.rewardStars(2, 10);
      this.callbacks.onTreasurePopup('The dolphin won! Great try!', 2, '🐬');
      narrator.say('The dolphin won! Great try!', true);
    }

    if (this.isFreeSwim) {
      const ev = this.hideSeek.update(dt, this.riverWorld, this.player.group.position, this.sparkles);
      if (ev === 'near') {
        this.callbacks.onTipMessage("You're getting close!");
      } else if (ev === 'found') {
        this.rewardStars(5, 25);
        sound.playMissionComplete();
        this.callbacks.onTreasurePopup('You found Pip!', 5, '🙈');
        narrator.say(cheer('You found Pip'), true);
        this.sparkles.burst(this.player.group.position, CONFETTI, 40, 4, 1.5);
      }
      if (!this.hideSeek.active && this.hideSeekInviteTimer > 0) {
        this.hideSeekInviteTimer -= dt;
        if (this.hideSeekInviteTimer <= 0) {
          this.callbacks.onTipMessage('Pip wants to play hide-and-seek! Tap 🙈');
        }
      }
    }
    this.emitMiniGame(r.progress);
  }

  /** Caimans and piranhas: a warning first, and getting caught only costs one snack. */
  private updateBadGuys(dt: number, isBoosting: boolean, chaseSpeed: number) {
    const events = this.badGuys.update(dt, this.player.group.position, isBoosting, chaseSpeed);
    for (const ev of events) {
      if (ev.type === 'warn') {
        if (this.elapsedSeconds - this.lastBadGuyTip > 12) {
          this.lastBadGuyTip = this.elapsedSeconds;
          this.callbacks.onTipMessage(
            ev.by === 'caiman' ? 'Shh! A caiman is sleeping. Swim around it!' : 'Grumpy piranhas! Zoom away!'
          );
        }
      } else if (ev.type === 'bump') {
        this.bump(ev.at);
      } else if (ev.type === 'caught') {
        if (ev.at) {
          this.bumpCooldown = 0;
          this.bump(ev.at);
        }
        this.loseSnack(ev.by);
      } else {
        this.lastBadGuyTip = this.elapsedSeconds;
        this.callbacks.onTipMessage(ev.by === 'caiman' ? 'Phew! Too slow, caiman!' : 'You got away!');
        this.sparkles.burst(this.player.group.position, ['#ffffff', '#bff6ff'], 12, 2);
      }
    }
  }

  private loseSnack(by: 'caiman' | 'piranhas') {
    this.tummy = Math.max(0, this.tummy - 15);
    this.callbacks.onTummyChange(Math.round(this.tummy));
    sound.playChomp();
    this.lastBadGuyTip = this.elapsedSeconds;
    if (by === 'caiman') {
      this.callbacks.onTreasurePopup('Snap! It took a snack!', 0, '🐊');
      narrator.say('Oh no! The caiman took a snack!', true);
    } else {
      this.callbacks.onTreasurePopup('Nibble! They took a snack!', 0, '🐟');
      narrator.say('Oh no! The piranhas took a snack!', true);
    }
  }

  /** Rainbow Whiskers, a sparkle-firework party with music, a family dance and the pearl. */
  private celebrateRainbow() {
    this.player.setRainbow(true);
    this.riverWorld.startFamilyParty(7);
    this.rainbowPartyTimer = 7;
    this.fireworkTimer = 0;
    sound.playRainbowParty();
    this.meetFriend('rainbow', false);
    this.counts.totalPoints += 100;
    this.saveLocalProgress();
    this.callbacks.onCountsChange({ ...this.counts });
    this.callbacks.onTreasurePopup('Rainbow Pearl!', 100, '🌈');
    narrator.say(`${cheer('You found the Rainbow Pearl')} Whiskers is rainbow colored!`, true);
    this.sparkles.burst(this.player.group.position, RAINBOW_COLORS, 60, 5, 2);
  }

  private updateRainbowParty(dt: number) {
    if (this.rainbowPartyTimer <= 0) return;
    this.rainbowPartyTimer -= dt;
    this.fireworkTimer -= dt;
    if (this.fireworkTimer <= 0) {
      this.fireworkTimer = 0.3;
      const p = this.player.group.position;
      _vec3B.set(p.x + (Math.random() - 0.5) * 16, 3 + Math.random() * 6, p.z + (Math.random() - 0.5) * 16);
      this.sparkles.burst(_vec3B, RAINBOW_COLORS, 30, 5, 0.5);
    }
  }

  private updateRingsChestsAndFriends(dt: number, prevDistance: number) {
    if (this.rainbow.checkReached(prevDistance, this.playerDistance, this.playerLateral)) {
      this.celebrateRainbow();
    }

    // Bubble rings: each one is a star; a whole trail is a "Perfect!" bonus.
    const ringEvents = this.ringManager.update(
      dt,
      prevDistance,
      this.playerDistance,
      this.playerLateral,
      this.playerDepth
    );
    for (const ev of ringEvents) {
      this.counts.stars += 1;
      this.counts.totalPoints += ev.trailComplete ? 30 : 5;
      sound.playCollectTreasure(ev.trailComplete ? 'shimmering_scale' : 'star');
      this.sparkles.burst(
        this.player.group.position,
        ['#ffd23f', '#fff3b0', '#ffb000'],
        ev.trailComplete ? 40 : 16,
        ev.trailComplete ? 4 : 2.6
      );
      if (ev.trailComplete) {
        this.callbacks.onTreasurePopup('Perfect!', 30, '🌈');
        narrator.say(cheer('Perfect! All the rings'), true);
      } else {
        this.callbacks.onTreasurePopup('Star!', 5, '⭐');
      }
      this.handleDailyMissionResult(this.dailyMissionsManager.recordEvent(['collect_star'], 1));
    }

    // Treasure chests.
    const opened = this.chestManager.update(dt, this.playerDistance, this.playerLateral);
    for (let i = 0; i < opened; i++) {
      this.counts.treasuresTotal += 3;
      this.counts.riverPearls += 1;
      this.counts.shimmeringScales += 1;
      this.counts.lostTrinkets += 1;
      this.counts.totalPoints += 60;
      sound.playCollectTreasure('lost_trinket');
      sound.playMilestone();
      this.callbacks.onTreasurePopup('Treasure chest!', 60, '🎁');
      this.sparkles.burst(this.player.group.position, ['#ff4d8d', '#4de3ff', '#7dff6b', '#c58bff', '#ffd84d'], 50, 4.2, 1.5);
      narrator.say(cheer('You found a treasure chest'), true);
      this.handleDailyMissionResult(
        this.dailyMissionsManager.recordEvent(['collect_any_treasure'], 3)
      );
      this.handleDailyMissionResult(
        this.dailyMissionsManager.recordEvent(['collect_scale_or_pearl'], 2)
      );
    }
    if (ringEvents.length > 0 || opened > 0) {
      this.saveLocalProgress();
      this.callbacks.onCountsChange({ ...this.counts });
    }

    // Friends: a few times a second, look for an animal not met yet within sniff range.
    this.friendScanTimer -= dt;
    if (this.friendScanTimer <= 0) {
      this.friendScanTimer = 0.25;
      const kind = findNearbyNewFriend(
        this.riverWorld.friendSpots,
        this.metFriends,
        this.player.group.position
      );
      if (kind && kind !== this.nearbyFriend && this.elapsedSeconds - this.lastFriendHintTime > 25) {
        this.lastFriendHintTime = this.elapsedSeconds;
        this.callbacks.onTipMessage(`A ${friendName(kind)} is nearby! Sniff to say hi!`);
      }
      this.setNearbyFriend(kind);
    }

    if (!this.friendIntroShown && this.swimSeconds > 9 && this.metFriends.size < 2) {
      this.friendIntroShown = true;
      this.callbacks.onTipMessage('Sniff near animals to make friends!');
    }
  }

  private updateChapter(forceUpdate: boolean) {
    let activeIdx = 0;
    for (let i = CHAPTERS.length - 1; i >= 0; i--) {
      if (this.playerDistance >= CHAPTERS[i].startDist) {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx !== this.currentChapterIndex || forceUpdate) {
      const prev = this.currentChapterIndex;
      this.currentChapterIndex = activeIdx;
      const chapter = CHAPTERS[activeIdx];
      this.highestChapterReached = Math.max(this.highestChapterReached, chapter.id);
      this.callbacks.onChapterChange(chapter);

      this.applyChapterLook(chapter, activeIdx);
      this.rainbow.setVisible(activeIdx === CHAPTERS.length - 1, forceUpdate);

      if (!forceUpdate && activeIdx > prev) {
        sound.playMilestone();
        this.callbacks.onTipMessage(`${chapter.name}!`);
      }
    }
  }

  /** Fog, sky, water and light colors for a chapter, by day or by night. */
  private applyChapterLook(chapter: RiverChapterInfo, idx: number) {
    const night = this.night;
    const fog = new THREE.Color(chapter.fogColor);
    if (night) fog.lerp(NIGHT_FOG, 0.82);
    this.scene.fog = new THREE.FogExp2(fog, idx === 4 ? 0.006 : 0.008);
    this.scene.background = fog.clone();
    this.sky.setColors(fog, night);
    const water = new THREE.Color(chapter.waterColor);
    if (night) water.lerp(NIGHT_WATER, 0.5);
    this.waterLook.uniforms.uWaterColor.value.copy(water);
    this.waterLook.uniforms.uDeepColor.value.copy(water).multiplyScalar(0.45);
    this.waterLook.uniforms.uSkyHorizon.value.copy(fog);
    this.waterLook.uniforms.uSkyZenith.value.copy(this.sky.zenithColor);
    this.hemiLight.color.set(night ? '#b3a8ff' : chapter.ambientLightColor);
    this.hemiLight.groundColor.set(night ? '#3d3466' : '#5c8065');
    this.hemiLight.intensity = night ? 1.15 : 1.7;
    this.dirLight.color.set(night ? '#ffb08a' : '#fff9e6');
    this.dirLight.intensity = night ? 1.3 : 2.2;
    this.scene.environmentIntensity = night ? 0.18 : 0.3;
    this.fireflies.setVisible(night);
  }

  /** Switch between day and the sunset/firefly night. */
  public setNight(on: boolean) {
    this.night = on;
    try {
      localStorage.setItem('whiskers_night', String(on));
    } catch {
      // ignore
    }
    this.applyChapterLook(CHAPTERS[this.currentChapterIndex], this.currentChapterIndex);
  }

  private triggerGrandLakeCelebration() {
    this.gameState = 'victory';
    this.callbacks.onStateChange('victory');
    this.setNearbyFriend(null);
    sound.playGrandLakeVictory();
    this.meetFriend('family', false);
    // Finale: the family swims over and circles Whiskers while the camera slowly orbits.
    this.riverWorld.setFamilyFollow(this.player.group.position);
    this.rainbow.setVisible(true);
    this.victoryTime = 0;
    const p = this.player.group.position;
    this.victoryOrbit = Math.atan2(this.camera.position.x - p.x, this.camera.position.z - p.z);
    this.sparkles.burst(p, CONFETTI, 60, 5, 2);
    narrator.say(cheer('You made it home! Great swimming'), true);
  }

  public dispose() {
    this.isRunning = false;
    cancelAnimationFrame(this.frameId);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);

    sound.stopRiverAmbience();
    this.player.dispose();
    this.riverWorld.dispose();
    this.itemManager.dispose();
    this.ringManager.dispose();
    this.chestManager.dispose();
    this.forest.dispose();
    this.sparkles.dispose();
    this.rainbow.dispose();
    this.badGuys.dispose();
    this.fireflies.dispose();
    this.race.dispose();
    this.sky.dispose();
    narrator.stop();
    this.renderer.dispose();

    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
