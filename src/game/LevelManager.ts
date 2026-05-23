import * as PIXI from 'pixi.js';
import { GameEntity, CONFIG } from './Types';
import { Renderer3D } from './Renderer3D';
import { SoundEffects } from './SoundEffects';

export class LevelManager {
  public entities: GameEntity[] = [];
  
  // Spawning intervals (in frame counts or ms. We will use delta-time counters)
  private essenceTimer: number = 0;
  private obstacleTimer: number = 0;
  private prereqTimer: number = 0;

  // Track active cascade anomalies for UI alerts
  public activeCascades: GameEntity[] = [];
  
  // Game metrics
  private entityIdCounter: number = 0;
  private elapsedTime: number = 0;
  public totalAnomaliesResolved: number = 0;

  constructor() {}

  public reset() {
    this.entities = [];
    this.activeCascades = [];
    this.essenceTimer = 0;
    this.obstacleTimer = 0;
    this.prereqTimer = 100; // Delay first prerequisite spawn a bit
    this.elapsedTime = 0;
    this.totalAnomaliesResolved = 0;
  }

  /**
   * Main Level update: Scrolls entities, manages timers, handles cascade triggers, and runs spawners
   */
  public update(scrollSpeed: number, unlockedLayersCount: number, dt: number, sfx: SoundEffects, activeWidth: number) {
    this.elapsedTime += (dt / 60);

    // 1. Move and update existing entities
    this.activeCascades = [];
    const remainingEntities: GameEntity[] = [];

    for (const ent of this.entities) {
      // Discard any entity that is on a locked Z-dimension layer!
      if (ent.z >= unlockedLayersCount) {
        continue;
      }

      // Scroll normal entities left
      if (ent.type === 'PROJECTILE') {
        // Projectiles move faster
        ent.x -= ent.speed * dt;
      } else {
        ent.x -= scrollSpeed * dt;
      }

      // Special Logic for Upstream Prerequisite Spawners
      if (ent.type === 'PREREQUISITE') {
        // Warning activates once the unit moves past X = triggerX (approaching central zone)
        const triggerX = Math.min(650, activeWidth * 0.7);
        const cascadeX = Math.min(300, activeWidth * 0.35);

        if (ent.x <= triggerX && ent.x > cascadeX) {
          ent.warningActive = true;
          // Calculate cascade progress as it travels from triggerX to cascadeX
          ent.cascadeProgress = Math.min(1, (triggerX - ent.x) / (triggerX - cascadeX));
          this.activeCascades.push(ent);
        } else if (ent.x <= cascadeX) {
          // Beyond cascadeX, it triggers the cascade if it hasn't yet
          ent.warningActive = true;
          ent.cascadeProgress = 1;
          this.activeCascades.push(ent);

          if (!ent.hasCascaded) {
            ent.hasCascaded = true;
            // Play a warning cue
            sfx.playShift();
          }

          // Trigger projectile stream on Layer 0 (Base Timeline)
          // Spawns projectile every ~15 frames while active
          if (Math.random() < 0.08) {
            this.spawnProjectile(ent.x, ent.y, 0); // target Layer 0
          }
        }
      }

      // Check if entity is still on board
      if (ent.x > -50) {
        remainingEntities.push(ent);
      }
    }
    this.entities = remainingEntities;

    // 2. Control Spawning Rates
    this.essenceTimer += dt;
    this.obstacleTimer += dt;
    this.prereqTimer += dt;

    // Essence Spawn: Every ~1.8 seconds (110 frames)
    if (this.essenceTimer >= 110) {
      this.essenceTimer = 0;
      // Spawn on a random unlocked layer
      const layer = Math.floor(Math.random() * unlockedLayersCount);
      this.spawnEssence(layer, activeWidth);
    }

    // Normal Obstacle Spawn: Scales with elapsed time (faster spawns as time goes on, up to a limit!)
    const baseObstacleInterval = 90;
    const timeProgress = Math.min(1.0, this.elapsedTime / 120); // max difficulty scaling at 120s
    const scaledInterval = Math.max(30, baseObstacleInterval - timeProgress * 60);

    if (this.obstacleTimer >= scaledInterval) {
      this.obstacleTimer = 0;
      const layer = Math.floor(Math.random() * unlockedLayersCount);
      this.spawnObstacle(layer, activeWidth);
    }

    // Upstream Prerequisite Spawners: Spawn only if at least Layer 1 is unlocked!
    // Spawns every ~9-12 seconds (600 frames)
    if (unlockedLayersCount > 1 && this.prereqTimer >= 600) {
      this.prereqTimer = 0;
      // Spawn on Layer 1 or 2
      const layer = Math.floor(Math.random() * (unlockedLayersCount - 1)) + 1;
      this.spawnPrerequisite(layer, activeWidth);
    }
  }

  private spawnEssence(layer: number, activeWidth: number) {
    this.entities.push({
      id: `essence_${this.entityIdCounter++}`,
      x: activeWidth + 20,
      y: 50 + Math.random() * (CONFIG.GAME_HEIGHT - 100),
      z: layer,
      type: 'ESSENCE',
      width: 14,
      height: 14,
      color: 0x00f0ff, // cyan
      speed: CONFIG.BASE_SCROLL_SPEED
    });
  }

  private spawnObstacle(layer: number, activeWidth: number) {
    this.entities.push({
      id: `obstacle_${this.entityIdCounter++}`,
      x: activeWidth + 20,
      y: 30 + Math.random() * (CONFIG.GAME_HEIGHT - 60),
      z: layer,
      type: 'OBSTACLE',
      width: 18 + Math.random() * 12,
      height: 18 + Math.random() * 12,
      color: 0xff3366, // neon pinkish red
      speed: CONFIG.BASE_SCROLL_SPEED
    });
  }

  private spawnPrerequisite(layer: number, activeWidth: number) {
    this.entities.push({
      id: `prereq_${this.entityIdCounter++}`,
      x: activeWidth + 40,
      y: 80 + Math.random() * (CONFIG.GAME_HEIGHT - 160),
      z: layer,
      type: 'PREREQUISITE',
      width: 32,
      height: 32,
      color: 0xff00ff, // glowing purple
      speed: CONFIG.BASE_SCROLL_SPEED * 0.5, // slower
      isCascadePrereq: true,
      cascadeTimelineIndex: 0,
      hasCascaded: false,
      cascadeProgress: 0,
      warningActive: false
    });
  }

  private spawnProjectile(x: number, y: number, layer: number) {
    this.entities.push({
      id: `proj_${this.entityIdCounter++}`,
      x: x,
      y: y + (Math.random() * 30 - 15), // slight variance
      z: layer,
      type: 'PROJECTILE',
      width: 22,
      height: 6,
      color: 0xff0033, // bright warning red
      speed: CONFIG.BASE_SCROLL_SPEED * 2.8 // very fast horizontal speed
    });
  }

  /**
   * Safely eliminate a specific entity (triggered by player collection, weapon, or ramming)
   */
  public removeEntity(id: string) {
    this.entities = this.entities.filter(e => e.id !== id);
  }

  public getElapsedTime(): number {
    return this.elapsedTime;
  }

  /**
   * Draw all level entities on screen using projected coordinates from Renderer3D
   */
  public draw(graphics: PIXI.Graphics, renderer: Renderer3D) {
    for (const ent of this.entities) {
      const pt = renderer.toScreen({ x: ent.x, y: ent.y, z: ent.z });
      const radius = ent.width / 2;

      if (ent.type === 'ESSENCE') {
        // Draw gorgeous spinning Time Essence
        const glowColor = renderer.getLayerColor(ent.z);
        graphics.lineStyle(1.5, 0xffffff, 0.95);
        graphics.beginFill(glowColor, 0.7);
        graphics.drawCircle(pt.x, pt.y, radius);
        graphics.endFill();

        // Outer sparkling rings
        graphics.lineStyle(1, 0xffffff, 0.45);
        graphics.drawCircle(pt.x, pt.y, radius + 5);
      } 
      else if (ent.type === 'OBSTACLE') {
        // Draw sharp polygonal dark matter obstacles
        graphics.lineStyle(2, ent.color, 0.9);
        graphics.beginFill(0x1a050d, 0.7);
        
        // Draw octahedron/diamond shape
        graphics.moveTo(pt.x, pt.y - radius);
        graphics.lineTo(pt.x + radius, pt.y);
        graphics.lineTo(pt.x, pt.y + radius);
        graphics.lineTo(pt.x - radius, pt.y);
        graphics.closePath();
        graphics.endFill();

        // Central core
        graphics.beginFill(ent.color, 0.5);
        graphics.drawCircle(pt.x, pt.y, 4);
        graphics.endFill();
      } 
      else if (ent.type === 'PREREQUISITE') {
        // Draw glowing purple Anomaly Spawner
        const isWarning = ent.warningActive;
        const col = isWarning ? 0xff00ff : 0xbf00ff;

        // Visual radar ring pulse
        if (isWarning && Math.floor(Date.now() / 200) % 2 === 0) {
          graphics.lineStyle(1.5, 0xff00ff, 0.4);
          graphics.drawCircle(pt.x, pt.y, radius + 15);
        }

        graphics.lineStyle(3, col, 0.95);
        graphics.beginFill(0x12031a, 0.85);
        
        // Hexagonal container shape
        const hex = 6;
        for (let i = 0; i < hex; i++) {
          const angle = (i * Math.PI) / 3;
          const hx = pt.x + radius * Math.cos(angle);
          const hy = pt.y + radius * Math.sin(angle);
          if (i === 0) graphics.moveTo(hx, hy);
          else graphics.lineTo(hx, hy);
        }
        graphics.closePath();
        graphics.endFill();

        // Draw inner status indicator
        graphics.lineStyle(0);
        graphics.beginFill(0xffffff, 0.9);
        graphics.drawRect(pt.x - 3, pt.y - 3, 6, 6);
        graphics.endFill();

        // Draw connection beam downwards to Layer 0 if warning is active!
        if (isWarning) {
          const basePt = renderer.toScreen({ x: ent.x, y: ent.y, z: 0 });
          graphics.lineStyle(2, 0xff00ff, 0.3 + 0.4 * (ent.cascadeProgress || 0));
          
          // Draw dashed warning connector beam
          const beamDy = basePt.y - pt.y;
          const beamSteps = 15;
          for (let j = 0; j < beamSteps; j += 2) {
            const y1 = pt.y + (beamDy * j) / beamSteps;
            const y2 = pt.y + (beamDy * (j + 1)) / beamSteps;
            // Interpolate X offset based on stacked layers
            const x1 = pt.x + ((basePt.x - pt.x) * j) / beamSteps;
            const x2 = pt.x + ((basePt.x - pt.x) * (j + 1)) / beamSteps;
            graphics.moveTo(x1, y1);
            graphics.lineTo(x2, y2);
          }
        }
      } 
      else if (ent.type === 'PROJECTILE') {
        // Draw sleek fast red projectile pulse
        graphics.lineStyle(0);
        graphics.beginFill(ent.color, 0.95);
        graphics.drawRoundedRect(pt.x - radius, pt.y - ent.height / 2, ent.width, ent.height, 3);
        graphics.endFill();
        
        // Glow trails
        graphics.beginFill(ent.color, 0.35);
        graphics.drawCircle(pt.x + radius, pt.y, 6);
        graphics.endFill();
      }
    }
  }
}
