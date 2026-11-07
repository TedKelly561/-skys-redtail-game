import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CatfishCharacter } from './catfishModel';
import {
  RiverWorld,
  CHAPTERS,
  getRiverPath,
  getRiverBedElevationAt,
  RiverChapterInfo,
} from './worldGen';
import { ItemManager, RiverItem } from './items';
import { sound } from './audio';
import {
  DailyMissionsManager,
  DailyMissionsState,
  DailyMissionMetric,
} from './dailyMissions';

const _vec3A = new THREE.Vector3();
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
  public paceMode: PaceMode = 'epic';
  public elapsedSeconds: number = 0;

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
  private isPointerDragging: boolean = false;
  private pointerStartX: number = 0;
  private pointerStartY: number = 0;

  private readonly SPEEDS = {
    epic: { base: 2.1, max: 3.1, boost: 4.5, hungry: 1.25 },
    cozy: { base: 4.4, max: 5.8, boost: 7.6, hungry: 2.8 },
  };

  private callbacks: GameCallbacks;
  private lastTummyRumbleTime: number = 0;
  private lastCurrentWhooshTime: number = 0;

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
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CHAPTERS[0].fogColor);
    this.scene.fog = new THREE.FogExp2(CHAPTERS[0].fogColor, 0.013);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(
      58,
      container.clientWidth / container.clientHeight,
      0.2,
      260
    );

    this.hemiLight = new THREE.HemisphereLight(0xf0fcff, 0x5c8065, 1.25);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff9e6, 1.65);
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
    this.dailyMissionsManager = new DailyMissionsManager();

    this.loadLocalProgress();
    this.callbacks.onDailyMissionsChange(this.dailyMissionsManager.getState());

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);

    this.isRunning = true;
    this.startLoop();
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.gameState !== 'playing') return;
    this.isPointerDragging = true;
    this.pointerStartX = e.clientX;
    this.pointerStartY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isPointerDragging || this.gameState !== 'playing') return;
    const dx = (e.clientX - this.pointerStartX) / 90;
    const dy = -(e.clientY - this.pointerStartY) / 90;
    this.touchSteerX = THREE.MathUtils.clamp(dx, -1, 1);
    this.touchSteerY = THREE.MathUtils.clamp(dy, -1, 1);
  };

  private onPointerUp = () => {
    if (this.isPointerDragging) {
      this.isPointerDragging = false;
      this.touchSteerX = 0;
      this.touchSteerY = 0;
    }
  };

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

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

    this.callbacks.onTipMessage(
      'Explore shallow sunlit riffles, sandy point bars, and dive into deep 6m scour pools for treasures!'
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
    this.itemManager.resetItems();
    this.startGame(0);
  }

  public triggerSonarPulse() {
    this.player.pulseBarbelSonar();
    sound.playBarbelSense();
    this.callbacks.onTipMessage(
      'Whiskers pulsed his 6 sensory barbels to detect nearby larvae, silver minnows, and shiny treasures!'
    );
    const res = this.dailyMissionsManager.recordEvent(['use_sonar'], 1);
    this.handleDailyMissionResult(res);
  }

  public startNextDailyMissionBonusSet() {
    const nextState = this.dailyMissionsManager.startNextBonusSet();
    this.callbacks.onDailyMissionsChange(nextState);
    this.callbacks.onTipMessage('Unlocked a fresh set of 3 Daily River Missions!');
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
        this.callbacks.onTreasurePopup(
          `All 3 Daily Missions Complete!`,
          res.totalBonusPointsEarned,
          '🎁'
        );
        this.callbacks.onTipMessage(
          `Amazing! You completed all 3 Daily Missions and earned the +100 pt All-Clear Bonus!`
        );
      } else if (res.completedMissions.length > 0) {
        const m = res.completedMissions[0];
        this.callbacks.onTreasurePopup(
          `Daily Mission: ${m.title}!`,
          m.rewardPoints,
          m.icon
        );
        this.callbacks.onTipMessage(
          `Daily Mission Complete: "${m.title}" (+${m.rewardPoints} Bonus Points)!`
        );
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
      }

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

  private updateTitleMode(dt: number) {
    const time = this.clock.getElapsedTime();
    const dist = 60 + Math.sin(time * 0.2) * 12;
    const { position, tangent } = getRiverPath(dist);

    this.player.group.position.set(position.x, -1.7 + Math.sin(time * 0.8) * 0.22, position.z);
    this.player.group.rotation.y = Math.atan2(tangent.x, tangent.z);
    this.player.update(dt, 1.4, Math.sin(time * 0.7) * 0.25, 0);

    const camAngle = time * 0.22;
    this.camera.position.set(
      position.x + Math.sin(camAngle) * 7.2,
      0.5 + Math.sin(time * 0.4) * 0.35,
      position.z + Math.cos(camAngle) * 7.2
    );
    this.camera.lookAt(this.player.group.position);

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

    if (this.inputs.sonarPulse) {
      this.triggerSonarPulse();
      this.inputs.sonarPulse = false;
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
      this.callbacks.onTipMessage(
        "Gurgle! Whiskers' tummy is getting hungry from swimming! Eat nearby larvae or silver minnows!"
      );
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
            this.callbacks.onTipMessage('Whoosh! Riding a sparkling river current!');
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

    this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed, targetSpeed, 3.2, dt);
    const distDelta = this.forwardSpeed * dt;
    this.playerDistance += distDelta;

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
        } else {
          if (Math.abs(dx) < log.length * 0.45 && Math.abs(dy) < log.radius + 0.45) {
            this.playerDepth = Math.min(-0.45, log.y + log.radius + 0.48);
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

    const velX = tangent.x * this.forwardSpeed + normal.x * this.lateralVelocity * 0.45;
    const velZ = tangent.z * this.forwardSpeed + normal.z * this.lateralVelocity * 0.45;
    this.player.group.rotation.y = Math.atan2(velX, velZ);

    this.player.update(dt, this.forwardSpeed, steerX, diveY);

    this.dirLight.position.set(worldX + 25, 48, worldZ + 15);
    this.dirLight.target.position.set(worldX, worldY, worldZ);
    this.dirLight.target.updateMatrixWorld();

    const camOffsetDist = 6.6;
    const camHeight = 2.45;
    _vec3A.set(
      worldX - tangent.x * camOffsetDist + normal.x * (steerX * 0.6),
      Math.max(0.1, worldY + camHeight),
      worldZ - tangent.z * camOffsetDist + normal.z * (steerX * 0.6)
    );
    this.camera.position.lerp(_vec3A, Math.min(1.0, dt * 5.2));

    _vec3B.set(worldX + tangent.x * 4.8, worldY + 0.25, worldZ + tangent.z * 4.8);
    this.camera.lookAt(_vec3B);

    this.riverWorld.update(dt, this.playerDistance);

    this.itemManager.updateAndCheckCollisions(
      dt,
      this.player.group.position,
      (item: RiverItem) => {
        this.counts.totalPoints += item.pointsValue;

        if (item.hungerRestore > 0) {
          this.tummy = Math.min(100, this.tummy + item.hungerRestore);
          this.counts.foodEaten += 1;
          this.callbacks.onTummyChange(Math.round(this.tummy));

          const icon =
            item.type === 'tiny_fish' ? '🐟' : item.type === 'berry' ? '🍒' : '🐛';
          this.callbacks.onTreasurePopup(
            `Ate ${item.label}! +${item.hungerRestore}% Full`,
            item.pointsValue,
            icon
          );
        } else if (item.type === 'star') {
          this.counts.stars += 1;
          this.callbacks.onTreasurePopup('Golden River Star!', item.pointsValue, '⭐');
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
          this.callbacks.onTreasurePopup(`Found ${item.label}!`, item.pointsValue, icon);
        }

        this.saveLocalProgress();
        this.callbacks.onCountsChange({ ...this.counts });

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

    if (this.playerDistance >= 2420 && this.gameState === 'playing') {
      this.triggerGrandLakeCelebration();
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

      this.scene.fog = new THREE.FogExp2(chapter.fogColor, activeIdx === 4 ? 0.01 : 0.013);
      this.scene.background = new THREE.Color(chapter.fogColor);
      this.hemiLight.color.set(chapter.ambientLightColor);

      if (!forceUpdate && activeIdx > prev) {
        sound.playMilestone();
        this.callbacks.onTipMessage(`Entered Chapter ${chapter.id}: ${chapter.name}!`);
      }
    }
  }

  private triggerGrandLakeCelebration() {
    this.gameState = 'victory';
    this.callbacks.onStateChange('victory');
    sound.playGrandLakeVictory();
    this.callbacks.onTipMessage(
      'You made it to the Great Grand Lake! Whiskers is home with his Redtail Catfish family!'
    );
  }

  public dispose() {
    this.isRunning = false;
    cancelAnimationFrame(this.frameId);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);

    sound.stopRiverAmbience();
    this.player.dispose();
    this.riverWorld.dispose();
    this.itemManager.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
