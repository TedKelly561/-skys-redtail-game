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
import { BushCats, CatTuning } from './cats';
import { FishHouse, HouseView } from './house';
import { BabyFish, BuddyLook } from './buddy';
import { LearningEvent, LearningMoments, LearningPrompt } from './learning';
import { debugFlag } from './debugFlags';
import { SeasonEffects, SeasonSetting, isHolidayTime, loadSeasonSetting, patchSeasonal, resolveSeason, saveSeasonSetting } from './seasons';
import { BubbleGeysers, Otter, TreasureDive, WaterfallSlide, dailyAllowance } from './lakeFun';
import { Fireflies } from './fireflies';
import { music } from './music';
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
const PLACE_KEY = 'whiskers_last_place';
const SHADOWS_OFF_KEY = 'whiskers_shadows_off';
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
const _vec3C = new THREE.Vector3();

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
  /** Whiskers swam into (true) or out of (false) his fish house. */
  onHouseChange: (open: boolean) => void;
  /** A learning question to show (null hides it). */
  onLearningPrompt: (prompt: LearningPrompt | null) => void;
}

export type Difficulty = 'gentle' | 'normal' | 'tricky';

/**
 * Bad guy settings per level. chase: 'slow' = slower than Whiskers' normal swim, otherwise a
 * fraction of his Zoom speed. snack: tummy taken when caught (0 = just a bump).
 */
const LAKE_KEY = 'whiskers_lake_unlocked';

/** How much faster Whiskers swims on Tricky. */
const TRICKY_SWIM = 1.3;

function scaleSpeeds(s: { base: number; max: number; boost: number; hungry: number }, k: number) {
  return { base: s.base * k, max: s.max * k, boost: s.boost * k, hungry: s.hungry * k };
}

const DIFFICULTY: Record<
  Difficulty,
  {
    wake: number;
    zoomWake: number;
    /** Meters a croc lunges toward Whiskers when it wakes (0 = snaps in place). */
    lunge: number;
    notice: number;
    chaseTime: number;
    chase: 'slow' | number;
    snack: number;
    cat: CatTuning;
    /** Extra crocs, piranhas and cats along the river. */
    extras: boolean;
  }
> = {
  gentle: { wake: 2.0, zoomWake: 2.6, lunge: 0, notice: 10, chaseTime: 2, chase: 'slow', snack: 0, cat: { trigger: 4.5, crouch: 0.9, lead: 0.15 }, extras: false },
  normal: { wake: 2.6, zoomWake: 4.2, lunge: 0, notice: 14, chaseTime: 3.5, chase: 0.8, snack: 15, cat: { trigger: 5.5, crouch: 0.6, lead: 0.5 }, extras: false },
  tricky: { wake: 3.6, zoomWake: 5.5, lunge: 2.6, notice: 18, chaseTime: 5, chase: 0.9, snack: 20, cat: { trigger: 8, crouch: 0.3, lead: 1 }, extras: true },
};

export interface MiniGameInfo {
  /** Free swimming in the lake and no game running: offer hide-and-seek. */
  canHideSeek: boolean;
  hideSeekActive: boolean;
  /** Both racers' progress (0..1) while the dolphin race is on. */
  race: RaceProgress | null;
  /** Today's treasure dive in the Grand Lake (free swim only). */
  pearls: { found: number; total: number } | null;
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
  private cats: BushCats;
  private buddy: BabyFish;
  private learning: LearningMoments;
  private seasonFx: SeasonEffects;
  public seasonSetting: SeasonSetting = 'auto';
  private buddyName = '';
  private house: FishHouse;
  private geysers: BubbleGeysers;
  private dive: TreasureDive;
  private otter: Otter;
  private falls: WaterfallSlide;
  /** Inside the fish house (and which part of the room we're looking at), or null. */
  public houseView: HouseView | null = null;
  /** A soft dark patch under Whiskers for when real shadows are off (slower computers). */
  private blobShadow!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private houseTime = 0;
  private houseCooldown = 0;
  private houseLook = new THREE.Vector3();
  private stickerCache: Partial<Record<FriendKind, string>> | null = null;
  private stickerCacheCount = -1;
  private diveHintCooldown = 0;
  private isJumping = false;
  private jumpVel = 0;
  private rideTangent = new THREE.Vector3();
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
  private placeSaveTimer = 3;
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
  /** Tricky swims faster (everything that chases or races scales with it, so it stays fair). */
  private readonly SPEEDS_TRICKY = {
    epic: scaleSpeeds(this.SPEEDS.epic, TRICKY_SWIM),
    cozy: scaleSpeeds(this.SPEEDS.cozy, TRICKY_SWIM),
  };

  private currentSpeeds() {
    return (this.difficulty === 'tricky' ? this.SPEEDS_TRICKY : this.SPEEDS)[this.paceMode];
  }

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
    this.renderer.shadowMap.enabled = this.shadowsWanted();
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
    this.dirLight.castShadow = this.renderer.shadowMap.enabled;
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
    this.blobShadow = this.makeBlobShadow();
    this.buddy = new BabyFish(this.scene);
    this.learning = new LearningMoments(this.scene);
    this.buddy.group.visible = false;

    this.riverWorld = new RiverWorld(this.scene);
    this.itemManager = new ItemManager(this.scene);
    this.ringManager = new RingManager(this.scene);
    this.chestManager = new ChestManager(this.scene);
    this.forest = new Forest(this.scene);
    this.sky = new Sky(this.scene, new THREE.Vector3(25, 48, 15));
    this.sparkles = new Sparkles(this.scene);
    this.rainbow = new RainbowGoal(this.scene);
    this.badGuys = new BadGuys(this.scene);
    this.cats = new BushCats(this.scene);
    this.house = new FishHouse(this.scene);
    this.geysers = new BubbleGeysers(this.scene);
    this.dive = new TreasureDive(this.scene);
    this.otter = new Otter(this.scene);
    this.falls = new WaterfallSlide(this.scene);
    this.riverWorld.friendSpots.push({ kind: 'otter', object: this.otter.body });
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
    this.streamer.addChildrenOf(this.cats.group, 140);
    this.streamer.addChildrenOf(this.house.group, 260);
    this.streamer.addChildrenOf(this.geysers.group, 200);
    this.streamer.addChildrenOf(this.dive.group, 170);
    this.streamer.add(this.otter.group, this.scene, 200);
    this.streamer.add(this.falls.group, this.scene, 240);
    this.streamer.addChildrenOf(this.race.group, 170);
    this.applyOutfit(loadCloset().outfit);
    this.applyChapterLook(CHAPTERS[0], 0);
    this.setDifficulty(GameEngine.loadDifficulty());
    // Seasons: trees, grass and banks change color; leaves or snow fall.
    if (!debugFlag('noseason')) patchSeasonal(this.forest.leafMaterial, 'leaf');
    if (!debugFlag('noseason')) patchSeasonal(this.forest.solidMaterial, 'leaf'); // round tree crowns are solid blobs; trunks and rocks aren't green so they stay put
    if (!debugFlag('noseason')) {
      patchSeasonal(this.riverWorld.bankGrassInstancedMesh.material as THREE.Material, 'grass');
      patchSeasonal(this.riverWorld.riverBedMaterial, 'ground');
    }
    this.seasonFx = new SeasonEffects(this.scene);
    this.setSeasonSetting(loadSeasonSetting(), false);
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

  /** Grown-ups setting for how tricky the caimans and piranhas are. */
  public difficulty: Difficulty = 'normal';

  public setDifficulty(level: Difficulty) {
    this.difficulty = level;
    const t = DIFFICULTY[level];
    this.badGuys.tuning = { wake: t.wake, zoomWake: t.zoomWake, lunge: t.lunge, notice: t.notice, chaseTime: t.chaseTime };
    this.badGuys.setExtras(t.extras);
    this.cats.tuning = t.cat;
    this.cats.setExtras(t.extras);
    try {
      localStorage.setItem('whiskers_difficulty', level);
    } catch {
      // ignore
    }
  }

  /** Where Whiskers was in the river last time (for Continue), or null. */
  public static loadDifficulty(): Difficulty {
    try {
      const saved = localStorage.getItem('whiskers_difficulty');
      if (saved === 'gentle' || saved === 'tricky') return saved;
    } catch {
      // ignore
    }
    return 'normal';
  }

  public static loadSavedPlace(): number | null {
    try {
      const d = Number(localStorage.getItem(PLACE_KEY));
      return Number.isFinite(d) && d > 60 && d < 2400 ? d : null;
    } catch {
      return null;
    }
  }

  private savePlace(distance: number | null) {
    try {
      if (distance === null) localStorage.removeItem(PLACE_KEY);
      else localStorage.setItem(PLACE_KEY, String(Math.round(distance)));
    } catch {
      // ignore
    }
  }

  /** Continue from the saved place in the river (a little before it, for a gentle restart). */
  /** True once Whiskers has reached the Grand Lake on this device. */
  public static isLakeUnlocked(): boolean {
    try {
      return localStorage.getItem(LAKE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /** Title shortcut: go straight to free swimming in the Grand Lake with the family. */
  public startLakeSwim() {
    this.startGame(CHAPTERS.length - 1);
    this.playerDistance = 2470;
    this.playerLateral = 0;
    this.playerDepth = -1.6;
    this.updateChapter(true);
    const { position, tangent } = getRiverPath(this.playerDistance);
    const heading = Math.atan2(tangent.x, tangent.z);
    this.player.group.position.set(position.x, this.playerDepth, position.z);
    this.player.group.rotation.set(0, heading, 0);
    this.camera.position.set(position.x - tangent.x * 6.2, 1.5, position.z - tangent.z * 6.2);
    this.meetFriend('family', false);
    this.riverWorld.setFamilyFollow(this.player.group.position);
    this.rainbow.setVisible(true);
    this.gameState = 'victory'; // free swim starts from the finale
    this.startFreeSwim();
    narrator.say('Welcome back to the Grand Lake!', true);
  }

  public continueGame() {
    const saved = GameEngine.loadSavedPlace();
    this.startGame(0);
    if (saved !== null) {
      this.playerDistance = Math.max(15, saved - 10);
      this.updateChapter(true);
      this.callbacks.onTipMessage('Welcome back! Keep swimming to the Grand Lake!');
    }
  }

  public startGame(startAtChapterIndex: number = 0) {
    this.isFreeSwim = false;
    this.riverWorld.setFamilyFollow(null);
    this.player.setRainbow(false);
    this.rainbow.reset();
    this.badGuys.reset();
    this.cats.reset();
    this.houseView = null;
    this.isJumping = false;
    this.jumpVel = 0;
    this.falls.cancel();
    this.learning.reset();
    this.callbacks.onLearningPrompt(null);
    this.race.reset();
    this.hideSeek.stop(this.riverWorld);
    this.hideSeekInviteTimer = 0;
    this.emitMiniGame(null);
    this.rainbowPartyTimer = 0;
    this.gameState = 'playing';
    this.callbacks.onStateChange('playing');
    sound.startRiverAmbience();
    music.start(Math.max(0, Math.min(CHAPTERS.length - 1, startAtChapterIndex)), this.night);

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
    const buddy = this.buddyName ? ` ${this.buddyName} is coming too!` : '';
    this.callbacks.onTipMessage(
      name ? `Let's go, ${name}!${buddy || ' Swim to the Grand Lake!'}` : `Swim down the river to the Grand Lake!${buddy}`
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
    this.learning.clear();
    this.callbacks.onLearningPrompt(null);
    this.isFreeSwim = true;
    this.freeHeading = this.player.group.rotation.y;
    this.turnVelocity = 0;
    this.gameState = 'playing';
    this.callbacks.onStateChange('playing');
    this.callbacks.onTipMessage('Swim anywhere! Find your fish house, bubble jumps and hidden pearls.');
    this.hideSeekInviteTimer = 7;
    this.emitMiniGame(null);
  }

  public triggerSonarPulse() {
    if (this.gameState !== 'playing') return;
    this.tryMeetNearbyFriend();
    if (this.hideSeek.active) {
      this.hideSeek.showDirection(this.player.group.position, this.sparkles);
      narrator.say('Pip is that way!', true);
    } else if (this.isFreeSwim && this.dive.foundCount < this.dive.total) {
      this.dive.showDirection(this.player.group.position, this.sparkles);
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
  public drawFriendStickers(size?: number) {
    return renderFriendStickers([
      ...this.riverWorld.friendSpots,
      { kind: 'rainbow', object: this.rainbow.pearl },
    ], size);
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
    this.buddy.celebrate();
    const name = friendName(kind);
    this.counts.totalPoints += 20;
    this.saveLocalProgress();
    this.callbacks.onCountsChange({ ...this.counts });
    sound.playMissionComplete();
    this.callbacks.onTreasurePopup(`Hi, ${name}!`, 20, '👋');
    this.sparkles.burst(this.player.group.position, ['#ff8fc0', '#ffffff', '#ffd1e8'], 26, 3);
    narrator.say(`Hi, ${name}! You made a new friend!`, true);
  }

  /** Friends met on another device (from the cloud save). */
  public addFriends(kinds: FriendKind[]) {
    let changed = false;
    for (const k of kinds) {
      if (!this.metFriends.has(k)) {
        this.metFriends.add(k);
        changed = true;
      }
    }
    if (!changed) return;
    saveMetFriends(this.metFriends);
    this.callbacks.onFriendsChange([...this.metFriends]);
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
    let lastStamp = -1;
    let smoothDt = 1 / 60;
    const tick = (stamp?: number) => {
      if (!this.isRunning) return;

      // Frame time from the browser's own frame clock (steadier than reading the time inside
      // the frame), smoothed a little so a slightly late frame doesn't make the river jump.
      // On slower or battery-saving laptops (30 frames a second) this keeps the glide even.
      let rawDt: number;
      if (typeof stamp === 'number' && lastStamp >= 0) {
        rawDt = Math.max(0, (stamp - lastStamp) / 1000);
        this.clock.getDelta(); // keep the clock in step
      } else {
        rawDt = this.clock.getDelta();
      }
      if (typeof stamp === 'number') lastStamp = stamp;
      if (rawDt > 0.25) smoothDt = 1 / 60; // back from a pause or another tab: start fresh
      else smoothDt += (rawDt - smoothDt) * 0.2;
      const dt = Math.min(rawDt > 0.25 ? rawDt : smoothDt, 0.05);

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
      if (!debugFlag('nolakefx') || this.isFreeSwim) this.updateLakeWorld(dt);
      if (this.buddy.group.visible) this.buddy.update(dt, this.player.group);
      this.seasonFx.update(dt, this.camera.position);
      this.waterLook.uniforms.uTime.value += dt;
      this.streamer.update(dt, this.player.group.position);
      this.watchShadowCost(rawDt);
      this.updateBlobShadow();
      if (!debugFlag('fixedres')) this.adaptiveResolution.update(rawDt);
      this.recordFrame(rawDt);
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
    if (this.falls.isRiding) {
      this.updateFallsRide(dt);
      return;
    }
    const speedCfg = this.currentSpeeds();
    this.swimSeconds += dt;
    this.houseCooldown = Math.max(0, this.houseCooldown - dt);
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
    _vec3C.set(nx, p.y, nz);
    if (this.houseCooldown <= 0 && !this.isJumping && this.house.isAtDoor(_vec3C)) {
      this.enterHouse();
      return;
    }
    const next = worldToRiver(nx, nz);
    const hitsHouse = this.house.hitsWall(_vec3C);
    if (hitsHouse && this.bumpCooldown <= 0) this.bump(this.house.center);
    const inside =
      !hitsHouse &&
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
    let pitch = diveY;
    if (this.isJumping) {
      // Bubble jump: up out of the water and back down with a splash.
      this.jumpVel -= 22 * dt;
      this.playerDepth += this.jumpVel * dt;
      pitch = THREE.MathUtils.clamp(this.jumpVel / 5, -2, 2);
      if (this.jumpVel < 0 && this.playerDepth < -0.5) {
        this.isJumping = false;
        this.jumpVel = 0;
        this.playerDepth = -0.6;
        this.depthVelocity = -2;
        sound.playSplash();
        _vec3B.set(x, 0.1, z);
        this.sparkles.burst(_vec3B, ['#ffffff', '#bff6ff', '#7fd8ff'], 28, 4.5, 2.4);
      }
    } else {
      this.depthVelocity = THREE.MathUtils.damp(this.depthVelocity, diveY * 5.2, 6.5, dt);
      this.playerDepth = THREE.MathUtils.clamp(
        this.playerDepth + this.depthVelocity * dt,
        Math.min(-0.85, bed + 0.45),
        -0.38
      );
    }

    this.player.group.position.set(x, this.playerDepth, z);
    this.player.group.rotation.y = this.freeHeading;
    this.player.update(dt, this.forwardSpeed, steerX, pitch);

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
    if (this.houseView) {
      this.updateHouse(dt);
      return;
    }
    const speedCfg = this.currentSpeeds();

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
    const level = DIFFICULTY[this.difficulty];
    this.updateBadGuys(dt, isBoosting, level.chase === 'slow' ? speedCfg.base * 0.9 : speedCfg.boost * level.chase);
    this.updateMiniGames(dt, prevDistance, (speedCfg.max + speedCfg.boost) / 2);
    const canLearn =
      !debugFlag('nolearn') &&
      !this.isFreeSwim && !this.hideSeek.active && this.playerDistance > 60 && this.playerDistance < 2150;
    for (const ev of this.learning.update(dt, this.playerDistance, this.playerLateral, canLearn, getPlayerName())) {
      this.handleLearning(ev);
    }

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

    // Remember the spot every few seconds for the Continue button.
    this.placeSaveTimer -= dt;
    if (this.placeSaveTimer <= 0 && !this.isFreeSwim) {
      this.placeSaveTimer = 3;
      this.savePlace(this.playerDistance);
    }

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
      pearls: this.isFreeSwim ? { found: this.dive.foundCount, total: this.dive.total } : null,
    };
    const key = JSON.stringify(info);
    if (key !== this.lastMiniKey) {
      this.lastMiniKey = key;
      this.callbacks.onMiniGameChange(info);
    }
  }

  // ------------------------------------------------------------ Grand Lake: house & fun

  /** Decorations Whiskers owns (from the grown-up-free star shop in the house). */
  public setHouseDecor(owned: string[]) {
    this.house.setOwned(owned);
  }

  private enterHouse() {
    this.houseView = 'room';
    this.houseTime = 0;
    this.isJumping = false;
    this.house.setTrophies(this.counts);
    if (!this.stickerCache || this.stickerCacheCount !== this.metFriends.size) {
      this.stickerCache = this.drawFriendStickers(256);
      this.stickerCacheCount = this.metFriends.size;
    }
    this.house.setFriendPictures([...this.metFriends], this.stickerCache);
    this.riverWorld.setFamilyFollow(this.house.exitPose().pos);
    const pose = this.house.viewPose('room', 0);
    this.camera.position.copy(pose.cam);
    this.houseLook.copy(pose.look);
    this.player.group.position.copy(pose.whiskers);
    this.callbacks.onHouseChange(true);
    sound.playMilestone();
    narrator.say('Welcome home! This is your fish house.', true);
  }

  public setHouseView(view: HouseView) {
    if (this.houseView) this.houseView = view;
  }

  public exitHouse() {
    if (!this.houseView) return;
    this.houseView = null;
    const { pos, heading } = this.house.exitPose();
    this.player.group.position.copy(pos);
    this.player.group.rotation.set(0, heading, 0);
    this.freeHeading = heading;
    this.turnVelocity = 0;
    this.forwardSpeed = 2;
    const r = worldToRiver(pos.x, pos.z);
    this.playerDistance = r.distance;
    this.playerLateral = r.lateral;
    this.playerDepth = pos.y;
    this.houseCooldown = 2.5;
    this.riverWorld.setFamilyFollow(this.player.group.position);
    this.camera.position.set(pos.x - Math.sin(heading) * 6.2, 1.5, pos.z - Math.cos(heading) * 6.2);
    this.callbacks.onHouseChange(false);
  }

  private updateHouse(dt: number) {
    if (!this.houseView) return;
    this.houseTime += dt;
    this.house.update(dt);
    const pose = this.house.viewPose(this.houseView, this.houseTime);
    const p = this.player.group.position;
    p.lerp(pose.whiskers, Math.min(1, dt * (this.houseView === 'bed' ? 2.5 : 5)));
    const g = this.player.group;
    const dy = Math.atan2(Math.sin(pose.yaw - g.rotation.y), Math.cos(pose.yaw - g.rotation.y));
    g.rotation.y += dy * Math.min(1, dt * 5);
    this.player.update(dt, this.houseView === 'bed' ? 0.15 : 1.4, 0, 0);
    this.camera.position.lerp(pose.cam, Math.min(1, dt * 3));
    this.houseLook.lerp(pose.look, Math.min(1, dt * 3));
    this.camera.lookAt(this.houseLook);
    this.dirLight.position.set(p.x + 25, 48, p.z + 15);
    this.dirLight.target.position.copy(p);
    this.dirLight.target.updateMatrixWorld();
  }

  private startJump() {
    this.isJumping = true;
    this.jumpVel = 12.5;
    sound.playWaterHop();
    this.sparkles.burst(this.player.group.position, ['#ffffff', '#bff6ff'], 20, 3.5, 2);
    if (dailyAllowance('jump', 10)) {
      this.rewardStars(1, 5);
      this.callbacks.onTreasurePopup('Bubble jump!', 1, '🫧');
    } else {
      this.callbacks.onTreasurePopup('Bubble jump!', 0, '🫧');
    }
  }

  private updateFallsRide(dt: number) {
    const p = this.player.group.position;
    const ev = this.falls.updateRide(dt, _vec3C, this.rideTangent);
    p.copy(_vec3C);
    const t = this.rideTangent;
    if (Math.hypot(t.x, t.z) > 0.05) {
      const want = Math.atan2(t.x, t.z);
      const d = Math.atan2(Math.sin(want - this.freeHeading), Math.cos(want - this.freeHeading));
      this.freeHeading += d * Math.min(1, dt * 8);
    }
    this.player.group.rotation.y = this.freeHeading;
    this.player.update(dt, 6, 0, THREE.MathUtils.clamp(t.y * 3, -2, 2));
    this.camera.position.lerp(this.falls.camSpot, Math.min(1, dt * 2));
    this.camera.lookAt(p);
    if (ev === 'whee') {
      sound.playWhee();
      narrator.say('Wheeee!', true);
    } else if (ev === 'splash') {
      sound.playSplash();
      _vec3B.set(p.x, 0.1, p.z);
      this.sparkles.burst(_vec3B, ['#ffffff', '#bff6ff', '#7fd8ff'], 34, 5, 2.6);
    } else if (ev === 'done') {
      this.riverWorld.setFamilyFollow(p);
      const r = worldToRiver(p.x, p.z);
      this.playerDistance = r.distance;
      this.playerLateral = r.lateral;
      this.playerDepth = Math.min(-0.6, p.y);
      this.forwardSpeed = 4;
      if (dailyAllowance('slide', 5)) {
        this.rewardStars(2, 10);
        this.callbacks.onTreasurePopup('Waterfall slide!', 2, '🌊');
      } else {
        this.callbacks.onTreasurePopup('Waterfall slide!', 0, '🌊');
      }
    }
  }

  /** Lake things animate every frame; games only run while free swimming. */
  private updateLakeWorld(dt: number) {
    const p = this.player.group.position;
    const playing = this.gameState === 'playing' && this.isFreeSwim && !this.houseView;
    const canPlay = playing && !this.falls.isRiding;

    if (this.geysers.update(dt, p, canPlay && !this.isJumping) >= 0) this.startJump();

    this.falls.update(dt, p);
    if (canPlay && !this.isJumping && this.falls.tryStart(p)) {
      this.riverWorld.setFamilyFollow(this.falls.entry); // the family waits at the bottom
      this.callbacks.onTipMessage('Whoosh! Up the bubble lift!');
      sound.playMilestone();
    }

    this.diveHintCooldown = Math.max(0, this.diveHintCooldown - dt);
    const gotPearl = canPlay && this.dive.update(dt, p);
    if (canPlay && !gotPearl && this.dive.aboveButHigh && this.diveHintCooldown <= 0) {
      this.diveHintCooldown = 10;
      this.callbacks.onTipMessage('A pearl is down there! Dive down to get it! ⬇️');
      narrator.say('Dive down to get the pearl!', true);
    }
    if (gotPearl) {
      const n = this.dive.foundCount;
      const all = n >= this.dive.total;
      this.rewardStars(all ? 8 : 3, 15);
      sound.playCollectTreasure('pearl');
      this.sparkles.burst(p, ['#ffe8f6', '#ffffff', '#c58ae0'], 30, 3, 1.4);
      if (all) {
        this.callbacks.onTreasurePopup('All the pearls! Come back tomorrow for more!', 8, '🦪');
        narrator.say(cheer('You found all the pearls today'), true);
      } else {
        this.callbacks.onTreasurePopup(`Pearl ${n} of ${this.dive.total}!`, 3, '🦪');
      }
    }

    const speedCfg = this.currentSpeeds();
    const fleeSpeed = (speedCfg.base * 0.85 + speedCfg.boost) / 2;
    const ev = this.otter.update(dt, p, fleeSpeed, canPlay && !this.hideSeek.active);
    if (ev === 'invite') {
      if (!this.metFriends.has('otter')) this.meetFriend('otter', true);
      this.callbacks.onTipMessage('The otter wants to play tag! Catch it! Zoom!');
      narrator.say('Tag! Catch the otter!', true);
    } else if (ev === 'tag') {
      sound.playGiggle();
      this.sparkles.burst(p, ['#ffd23f', '#ffffff', '#ffb36b'], 22, 3, 1.4);
      if (dailyAllowance('tag', 30)) {
        this.rewardStars(1, 5);
        this.callbacks.onTreasurePopup('Tag! Again!', 1, '🦦');
      } else {
        this.callbacks.onTreasurePopup('Tag! Again!', 0, '🦦');
      }
    } else if (ev === 'win') {
      sound.playMissionComplete();
      this.sparkles.burst(p, CONFETTI, 40, 4, 1.5);
      const stars = dailyAllowance('tagwin', 3) ? 5 : 0;
      if (stars) this.rewardStars(stars, 25);
      this.callbacks.onTreasurePopup('You won tag!', stars, '🏆');
      narrator.say(cheer('You won tag'), true);
    } else if (ev === 'bye') {
      this.callbacks.onTipMessage('The otter is tired. Play again later!');
    }
  }

  /**
   * Photo mode: a "selfie" of Whiskers (and his buddy) from the front, or the room view inside
   * the fish house. The on-screen buttons are not part of the 3D view, so they never show up.
   */
  public takePhoto(): string | null {
    const cam = this.camera;
    const savedPos = cam.position.clone();
    const savedQuat = cam.quaternion.clone();
    let unpose: (() => void) | null = null;
    try {
      if (!this.houseView) {
        const p = this.player.group.position;
        const h = this.player.group.rotation.y;
        cam.position.set(p.x + Math.sin(h) * 3.1 + Math.cos(h) * 0.9, p.y + 0.75, p.z + Math.cos(h) * 3.1 - Math.sin(h) * 0.9);
        cam.lookAt(p.x - Math.cos(h) * 0.35, p.y + 0.25, p.z + Math.sin(h) * 0.35);
        if (this.buddy.group.visible) unpose = this.buddy.poseForPhoto(this.player.group, cam.position);
      }
      this.renderer.render(this.scene, cam);
      return this.renderer.domElement.toDataURL('image/jpeg', 0.92);
    } catch (err) {
      console.warn('Could not take a photo:', err);
      return null;
    } finally {
      unpose?.();
      cam.position.copy(savedPos);
      cam.quaternion.copy(savedQuat);
      sound.playShutter();
      this.buddy.celebrate();
    }
  }

  // ------------------------------------------------------------ Troubleshooting readout (?debug)
  private frameTimes: number[] = [];
  private lastPixelRatio = 0;
  private pixelRatioChanges = 0;

  private makeBlobShadow() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1.3, 3.0);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: '#0b2a33',
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.renderOrder = 1;
    this.scene.add(mesh);
    return mesh;
  }

  private updateBlobShadow() {
    const blob = this.blobShadow;
    const show = !this.dirLight.castShadow && this.gameState === 'playing' && !this.houseView && this.player.group.visible;
    blob.visible = show;
    if (!show) return;
    const p = this.player.group.position;
    const bed = getRiverBedElevationAt(this.playerDistance, this.playerLateral);
    const height = Math.max(0, p.y - bed);
    blob.position.set(p.x, bed + 0.04, p.z);
    blob.rotation.y = this.player.group.rotation.y;
    blob.scale.setScalar(1 + height * 0.06);
    blob.material.opacity = 0.5 * THREE.MathUtils.clamp(1 - height / 7, 0.2, 1);
  }

  /** Shadows are the costliest effect on some laptops; this device turned them off before. */
  private shadowsWanted() {
    const force = debugFlag('shadows');
    try {
      if (force) localStorage.removeItem(SHADOWS_OFF_KEY);
      if (this.isSoftwareGl || debugFlag('noshadow')) return false;
      return force || localStorage.getItem(SHADOWS_OFF_KEY) !== '1';
    } catch {
      return !this.isSoftwareGl;
    }
  }

  private shadowWatch = { warmup: 4, total: 0, samples: 0, slowWindows: 0 };

  /**
   * If frames stay slow (under about 45 a second) with shadows on, turn them off: on some
   * laptops they halve the frame rate, and uneven frames make the river look bumpy. The choice is
   * remembered on this device. Add ?shadows to the address to bring them back.
   */
  private watchShadowCost(rawDt: number) {
    if (!this.dirLight.castShadow || debugFlag('shadows')) return;
    if (rawDt <= 0 || rawDt > 0.25) return; // ignore tab switches and loading hitches
    const w = this.shadowWatch;
    if (w.warmup > 0) {
      w.warmup -= rawDt;
      return;
    }
    w.total += rawDt;
    w.samples++;
    if (w.total < 3) return;
    const avgMs = (w.total / w.samples) * 1000;
    w.total = 0;
    w.samples = 0;
    w.slowWindows = avgMs > 22 ? w.slowWindows + 1 : 0;
    if (w.slowWindows < 2) return;
    this.dirLight.castShadow = false;
    this.renderer.shadowMap.enabled = false;
    this.dirLight.shadow.map?.dispose();
    this.dirLight.shadow.map = null;
    // Shadows were the slow part, so give full sharpness another chance.
    this.adaptiveResolution.reset();
    try {
      localStorage.setItem(SHADOWS_OFF_KEY, '1');
    } catch {
      // ignore
    }
  }

  private recordFrame(rawDt: number) {
    this.frameTimes.push(rawDt * 1000);
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    const pr = this.renderer.getPixelRatio();
    if (this.lastPixelRatio && pr !== this.lastPixelRatio) this.pixelRatioChanges++;
    this.lastPixelRatio = pr;
  }

  public getDebugStats() {
    const t = this.frameTimes;
    const avg = t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0;
    const worst = t.length ? Math.max(...t) : 0;
    const cam = this.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    return {
      fps: avg ? Math.round(1000 / avg) : 0,
      avgMs: avg.toFixed(1),
      worstMs: worst.toFixed(0),
      pixelRatio: this.renderer.getPixelRatio().toFixed(2),
      resChanges: this.pixelRatioChanges,
      camY: cam.position.y.toFixed(2),
      pitch: THREE.MathUtils.radToDeg(Math.asin(dir.y)).toFixed(1),
      whiskersY: this.player.group.position.y.toFixed(2),
      calls: this.renderer.info.render.calls,
      gpu: this.isSoftwareGl ? 'software' : 'hardware',
      shadows: this.dirLight.castShadow ? 'shadows on' : 'shadows off',
    };
  }

  /** Learning moments on/off (grown-ups). */
  public setLearningEnabled(on: boolean) {
    this.learning.setEnabled(on);
    if (!on) this.callbacks.onLearningPrompt(null);
  }

  public get learningEnabled() {
    return this.learning.enabled;
  }

  /** The child tapped an answer on a learning question. */
  public answerLearning(option: string) {
    const ev = this.learning.answer(option);
    if (ev) this.handleLearning(ev);
  }

  private handleLearning(ev: LearningEvent) {
    if (ev.type === 'prompt') {
      this.callbacks.onLearningPrompt(ev.prompt);
      sound.playBarbelSense();
      narrator.say(ev.say, true);
    } else if (ev.type === 'result') {
      if (ev.correct) {
        this.rewardStars(2, 10);
        sound.playMissionComplete();
        this.sparkles.burst(ev.at, CONFETTI, 30, 3.5, 1.4);
        this.callbacks.onTreasurePopup(ev.text, 2, '🎉');
      } else {
        this.callbacks.onTreasurePopup(ev.text, 0, '💛');
      }
      narrator.say(ev.say, true);
      this.callbacks.onLearningPrompt(null);
    } else {
      this.callbacks.onLearningPrompt(null);
    }
  }

  /** Grown-ups season choice ('auto' follows the calendar). */
  public setSeasonSetting(setting: SeasonSetting, save = true) {
    this.seasonSetting = setting;
    if (save) saveSeasonSetting(setting);
    this.seasonFx.setSeason(debugFlag('noseason') ? 'summer' : resolveSeason(setting), isHolidayTime());
  }

  /** Whiskers' baby fish buddy (null hides it). */
  public setBuddy(look: BuddyLook | null) {
    if (debugFlag('nobuddy')) look = null;
    this.buddy.group.visible = !!look;
    this.buddyName = look?.name || '';
    if (look) this.buddy.setColor(look.color);
  }

  private rewardStars(stars: number, points: number) {
    if (stars > 0) this.buddy.celebrate();
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
            ev.by === 'caiman' ? 'Shh! A croc is sleeping. Swim around it!' : 'Grumpy piranhas! Zoom away!'
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
        this.callbacks.onTipMessage(ev.by === 'caiman' ? 'Phew! Too slow, croc!' : 'You got away!');
        this.sparkles.burst(this.player.group.position, ['#ffffff', '#bff6ff'], 12, 2);
      }
    }

    for (const ev of this.cats.update(dt, this.player.group.position)) {
      if (ev.type === 'warn') {
        if (this.elapsedSeconds - this.lastBadGuyTip > 12) {
          this.lastBadGuyTip = this.elapsedSeconds;
          this.callbacks.onTipMessage('Rustle rustle... something is hiding in the bushes!');
        }
      } else if (ev.type === 'pounce') {
        sound.playMeow();
        this.lastBadGuyTip = this.elapsedSeconds;
        this.callbacks.onTipMessage('A cat! Swim away from the bank!');
        narrator.say('A cat! Swim away!', true);
      } else if (ev.type === 'caught') {
        this.bumpCooldown = 0;
        this.bump(ev.at);
        this.loseSnack('cat');
      } else if (ev.type === 'splash') {
        sound.playSplash();
        window.setTimeout(() => sound.playMeow(true), 450);
        this.sparkles.burst(ev.at, ['#ffffff', '#bff6ff', '#7fd8ff'], 26, 4.5, 2.2);
        this.lastBadGuyTip = this.elapsedSeconds;
        this.callbacks.onTreasurePopup('SPLASH! The cat fell in!', 0, '💦');
        narrator.say(`${cheer('You got away')} The cat fell in the water!`, true);
      } else {
        this.sparkles.burst(ev.at, ['#bff6ff', '#7fd8ff', '#ffffff'], 18, 2.5, 1.2);
      }
    }
  }

  private loseSnack(by: 'caiman' | 'piranhas' | 'cat') {
    this.lastBadGuyTip = this.elapsedSeconds;
    const loss = DIFFICULTY[this.difficulty].snack;
    if (loss === 0) {
      // Gentle: just a bump and a friendly reminder.
      this.callbacks.onTipMessage(
        by === 'caiman'
          ? 'Boing! Swim around the croc!'
          : by === 'cat'
            ? 'Boing! Stay away from the bushes!'
            : 'Boing! Zoom away from the piranhas!'
      );
      return;
    }
    this.tummy = Math.max(0, this.tummy - loss);
    this.callbacks.onTummyChange(Math.round(this.tummy));
    sound.playChomp();
    if (by === 'caiman') {
      this.callbacks.onTreasurePopup('Snap! It took a snack!', 0, '🐊');
      narrator.say('Oh no! The croc took a snack!', true);
    } else if (by === 'cat') {
      this.callbacks.onTreasurePopup('Swipe! The cat took a snack!', 0, '🐈‍⬛');
      narrator.say('Oh no! The cat took a snack!', true);
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
      if (this.gameState !== 'title') music.start(activeIdx, this.night);
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
    music.start(this.currentChapterIndex, on);
  }

  private triggerGrandLakeCelebration() {
    this.savePlace(null); // journey finished: next time starts fresh
    try {
      localStorage.setItem(LAKE_KEY, 'true');
    } catch {
      // ignore
    }
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
    this.blobShadow.geometry.dispose();
    this.blobShadow.material.map?.dispose();
    this.blobShadow.material.dispose();
    this.sparkles.dispose();
    this.rainbow.dispose();
    this.badGuys.dispose();
    this.buddy.dispose();
    this.learning.dispose();
    this.seasonFx.dispose();
    this.house.dispose();
    this.geysers.dispose();
    this.dive.dispose();
    this.otter.dispose();
    this.falls.dispose();
    this.cats.dispose();
    this.fireflies.dispose();
    this.race.dispose();
    this.sky.dispose();
    narrator.stop();
    music.stop();
    this.renderer.dispose();

    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
