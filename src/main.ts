import * as PIXI from 'pixi.js';
import { Snake } from './game/Snake';
import { Renderer3D } from './game/Renderer3D';
import { LevelManager } from './game/LevelManager';
import { CollisionSystem } from './game/CollisionSystem';
import { SoundEffects } from './game/SoundEffects';
import { UI } from './game/UI';
import { CONFIG, GameState, Point3D } from './game/Types';

class GameController {
  private app!: PIXI.Application;
  private renderer3D!: Renderer3D;
  private snake!: Snake;
  private levelManager!: LevelManager;
  private collisionSystem!: CollisionSystem;
  private sfx!: SoundEffects;
  private ui!: UI;

  private state: GameState = 'MENU';

  // Rendering containers
  private backgroundGraphics = new PIXI.Graphics();
  private gameplayGraphics = new PIXI.Graphics();

  // Inputs
  private keys: { [key: string]: boolean } = {};
  private preventDefaultKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift', 'KeyQ', 'KeyE'];

  // Game metrics
  private score: number = 0;
  private scoreMultiplier: number = 1.0;
  private maxLengthReached: number = CONFIG.INITIAL_SNAKE_LENGTH;

  // Scroll metrics
  private scrollOffset: number = 0;
  private rewindTimer: number = 0;
  private spawnGraceTimer: number = 0;

  constructor() {
    this.initPixi();
    this.sfx = new SoundEffects();
    this.levelManager = new LevelManager();
    this.collisionSystem = new CollisionSystem();
    this.ui = new UI(() => this.startGame(), this.sfx);

    this.setupInput();
    this.ui.showMenu();
  }

  private initPixi() {
    this.app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x06060c,
      antialias: true,
      resizeTo: window
    });

    document.getElementById('canvas-container')!.appendChild(this.app.view as HTMLCanvasElement);

    this.app.stage.addChild(this.backgroundGraphics);
    this.app.stage.addChild(this.gameplayGraphics);

    this.renderer3D = new Renderer3D(this.app);

    // Dynamic resize handler
    window.addEventListener('resize', () => {
      this.renderer3D.updateDimensions();
    });

    // PixiJS Tick
    this.app.ticker.add((dt) => this.gameLoop(dt));
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (this.preventDefaultKeys.includes(e.code) || this.preventDefaultKeys.includes(e.key)) {
        e.preventDefault();
      }

      if (this.state === 'PLAYING') {
        // Dimension Jump: Q or Shift to go down, E or Space to go up
        const layers = this.getUnlockedLayersCount();
        if (e.code === 'KeyE' || e.code === 'Space') {
          this.snake.shiftDimension('UP', layers, this.sfx);
          this.sfx.setDimensionHum(this.snake.head.z);
        } else if (e.code === 'KeyQ' || e.shiftKey || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          this.snake.shiftDimension('DOWN', layers, this.sfx);
          this.sfx.setDimensionHum(this.snake.head.z);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  private startGame() {
    this.sfx.enableAudio();
    this.state = 'PLAYING';

    // Create new player timeline snake with dynamic starting X based on length
    const startX = Math.max(150, Math.min(500, CONFIG.INITIAL_SNAKE_LENGTH * CONFIG.NODE_SPACING * 1.5 + 50));
    this.snake = new Snake(startX, CONFIG.GAME_HEIGHT / 2, 0);
    this.sfx.setDimensionHum(0);

    // Reset components and stats
    this.levelManager.reset();
    this.score = 0;
    this.spawnGraceTimer = 5.0;
    this.scoreMultiplier = 1.0;
    this.maxLengthReached = CONFIG.INITIAL_SNAKE_LENGTH;
    this.scrollOffset = 0;

    this.ui.showGameplay();
  }

  private gameLoop(dt: number) {
    if (this.state === 'PLAYING') {
      this.updatePlaying(dt);
    } else if (this.state === 'REWINDING') {
      this.updateRewinding(dt);
    } else {
      // Just render background animations on menus/end screens
      this.scrollOffset += 0.5 * dt;
      this.renderer3D.drawGrids(this.backgroundGraphics, 1, this.scrollOffset, 3, 0);
      this.gameplayGraphics.clear();
    }
  }

  private getUnlockedLayersCount(): number {
    const len = this.snake.length;
    // Perfect square formula starting at L = 4 (n >= 2)
    if (len < 4) return 1;
    return Math.floor(Math.sqrt(len));
  }

  private updatePlaying(dt: number) {
    // Decrement starting invincibility grace period
    if (this.spawnGraceTimer > 0) {
      this.spawnGraceTimer = Math.max(0, this.spawnGraceTimer - dt / 60);
    }

    // 1. Scaled Difficulty scroll speed
    // Scroll speed escalates as elapsed time increases
    const elapsedSec = this.levelManager.getElapsedTime();
    const scrollSpeed = CONFIG.BASE_SCROLL_SPEED + Math.min(1.8, (elapsedSec / 120) * 1.8);

    // Shift scrolling grids
    this.scrollOffset += scrollSpeed * dt;

    // 2. Read Keyboard movement vectors
    let dx = 0;
    let dy = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

    // Standardize diagonal velocity vectors
    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    // Scroll historical snake path coordinates leftwards
    this.snake.scrollHistory(scrollSpeed * dt);

    // Apply movement updates to Snake
    const unlockedLayers = this.getUnlockedLayersCount();
    if (dx !== 0 || dy !== 0) {
      this.snake.move(dx, dy);
    } else {
      this.snake.idleUpdate();
    }

    // Calculate activeWidth of the playable timeline zone dynamically
    const activeWidth = Math.min(CONFIG.GAME_WIDTH, Math.max(180, (this.snake.length / 16) * CONFIG.GAME_WIDTH));

    // Update level elements (move and spawn obstacles/essences at activeWidth)
    this.levelManager.update(scrollSpeed, unlockedLayers, dt, this.sfx, activeWidth);

    // 3. Collision Checks & State Resolutions
    this.checkCollisions();

    // 4. Fail / Win Checks
    if (this.spawnGraceTimer <= 0 && (this.snake.isTailOut() || this.snake.length < 3)) {
      this.triggerGameOver("Timeline collapsed! Your snake tail was forced past the Left Present line (Death Line).");
      return;
    }

    // Victory condition: reaching length >= CONFIG.VICTORY_LENGTH
    if (this.snake.length >= CONFIG.VICTORY_LENGTH) {
      this.triggerVictory();
      return;
    }

    // 5. Drawing Layers
    this.renderer3D.drawGrids(this.backgroundGraphics, unlockedLayers, this.scrollOffset, this.snake.length, this.snake.head.z);

    this.gameplayGraphics.clear();
    this.levelManager.draw(this.gameplayGraphics, this.renderer3D);
    this.snake.draw(this.gameplayGraphics, this.renderer3D, this.spawnGraceTimer > 0);

    // 6. Update HUD Stats (counting stopwatch time upwards)
    this.ui.updateHUD(
      Math.floor(this.score),
      this.scoreMultiplier,
      this.snake.length,
      this.levelManager.getElapsedTime(),
      unlockedLayers
    );

    this.ui.updateImmunity(this.spawnGraceTimer);
    this.ui.updateAlerts(this.levelManager.activeCascades);
  }

  private checkCollisions() {
    // Collect Time Essences (System A)
    const essence = this.collisionSystem.checkHeadEssenceCollisions(this.snake, this.levelManager.entities);
    if (essence) {
      this.levelManager.removeEntity(essence.id);
      this.snake.grow();
      this.sfx.playCollect();

      // Check max length
      if (this.snake.length > this.maxLengthReached) {
        this.maxLengthReached = this.snake.length;
      }

      this.score += 100 * this.scoreMultiplier;
      this.scoreMultiplier = Math.min(4.0, this.scoreMultiplier + 0.1);
    }

    // Upstream Prerequisite Spawners ramming (Intervention Law)
    const prereq = this.collisionSystem.checkHeadObstacleCollisions(this.snake, this.levelManager.entities);
    if (prereq && prereq.type === 'PREREQUISITE') {
      this.levelManager.removeEntity(prereq.id);
      this.levelManager.totalAnomaliesResolved++;

      if (prereq.hasCascaded) {
        // Already triggered cascade, resolve base layer stream and award points
        this.score += 800 * this.scoreMultiplier;
        this.sfx.playCascadeCleared();
      } else {
        // Prevented cascade in advance! High-reward upstream intervention
        this.score += 1800 * this.scoreMultiplier;
        this.sfx.playCascadeCleared();
        // Clear all scheduled red lasers currently on base layer to represent anomaly stabilization
        this.levelManager.entities = this.levelManager.entities.filter(
          e => !(e.type === 'PROJECTILE' && e.z === 0)
        );
      }
      this.scoreMultiplier = Math.min(4.0, this.scoreMultiplier + 0.4);
      return; // ramming prereq doesn't cause collision damage!
    }

    // Bypassing dangerous collisions during spawn invincibility grace period
    if (this.spawnGraceTimer > 0) {
      return;
    }

    // Dangerous Obstacles and Laser Projectiles
    // Check Head vs Obstacles (System A)
    const headHit = this.collisionSystem.checkHeadObstacleCollisions(this.snake, this.levelManager.entities);
    if (headHit) {
      this.triggerRewind();
      return;
    }

    // Check lagging body vs center-left obstacles (System B)
    const bodyHit = this.collisionSystem.checkBodyObstacleCollisions(this.snake, this.levelManager.entities);
    if (bodyHit) {
      this.triggerRewind();
      return;
    }

    // Check Self-Collision (3D Time Paradox)
    if (this.collisionSystem.checkSelfCollision(this.snake)) {
      this.triggerRewind();
      return;
    }
  }

  /**
   * Execute dynamic Chronal Rewind sequence
   */
  private triggerRewind() {
    this.state = 'REWINDING';
    this.sfx.playRewind();

    // 1. Calculate sever length (20% of current node length, min 3)
    const severCount = Math.max(3, Math.round(this.snake.length * 0.2));
    this.rewindTimer = 45; // 45 frames (approx 0.75s animation time)

    // Reset multiplier streak
    this.scoreMultiplier = 1.0;

    // Show rewind banner overlay
    this.ui.showRewind(severCount);
  }

  private updateRewinding(dt: number) {
    this.rewindTimer -= dt;

    // Flash/Glitch renderer backgrounds during rewind
    const unlockedLayers = this.getUnlockedLayersCount();
    if (Math.floor(this.rewindTimer / 4) % 2 === 0) {
      this.app.renderer.background.color = 0x220508; // deep red flash
    } else {
      this.app.renderer.background.color = 0x06060c;
    }

    // Render backgrounds static
    this.renderer3D.drawGrids(this.backgroundGraphics, unlockedLayers, this.scrollOffset, this.snake.length, this.snake.head.z);

    this.gameplayGraphics.clear();
    this.levelManager.draw(this.gameplayGraphics, this.renderer3D);
    this.snake.draw(this.gameplayGraphics, this.renderer3D);

    if (this.rewindTimer <= 0) {
      // 2. Perform the physical node retraction
      const severCount = Math.max(3, Math.round(this.snake.length * 0.2));
      const targetLength = this.snake.length - severCount;

      if (targetLength < 3) {
        this.app.renderer.background.color = 0x06060c;
        this.triggerGameOver("Temporal Paradox Severance! Retracting nodes dropped your timeline length below the minimal sustain threshold of 3.");
        return;
      }

      // Calculate layers count after the shrink to handle dimension locking
      let layersAfter = 1;
      if (targetLength >= 16) {
        layersAfter = Math.floor(Math.sqrt(targetLength)) - 2;
      }

      // Retract head position N nodes backwards in history
      // Get the safe historical coordinate
      let safePos: Point3D = { x: 50, y: CONFIG.GAME_HEIGHT / 2, z: 0 };

      // If we don't have enough history nodes (which shouldn't happen due to padding), default to base
      // If the historical coordinates are past X=0, it triggers a loss!
      if (this.snake.body.length > severCount) {
        const bodyNode = this.snake.body[severCount];
        safePos = { ...bodyNode };
      }

      // Clamp the safe coordinate Z dimension to prevent forcing the head on a locked dimension
      safePos.z = Math.min(safePos.z, layersAfter - 1);

      if (safePos.x <= 10) {
        this.app.renderer.background.color = 0x06060c;
        this.triggerGameOver("Temporal Paradox Severance! Safe rewind coordinates lay outside the Present boundary.");
        return;
      }

      // Sever tail segments and force head position
      this.snake.rewindShrink(severCount, layersAfter);
      this.snake.forcePosition(safePos, layersAfter);

      this.sfx.setDimensionHum(this.snake.head.z);

      // Clean all obstacles and lasers in the head's immediate radius (x +- 120) to ensure a safe respawn
      this.levelManager.entities = this.levelManager.entities.filter(
        e => !(Math.abs(e.x - safePos.x) < 120 && Math.abs(e.y - safePos.y) < 120 && e.z === safePos.z)
      );

      // Resume game
      this.app.renderer.background.color = 0x06060c;
      this.state = 'PLAYING';
      this.ui.hideRewind();
    }
  }

  private triggerGameOver(cause: string) {
    this.state = 'GAMEOVER';
    this.sfx.playGameOver();
    this.app.renderer.background.color = 0x06060c;

    this.ui.showGameOver(cause, {
      score: Math.floor(this.score),
      maxLength: this.maxLengthReached,
      maxLayers: this.getUnlockedLayersCount(),
      anomalies: this.levelManager.totalAnomaliesResolved
    });
  }

  private triggerVictory() {
    this.state = 'VICTORY';
    this.sfx.playVictory();

    // Bonus points for excess length
    const lengthBonus = (this.snake.length - 16) * 500;
    this.score += lengthBonus;

    this.ui.showVictory({
      score: Math.floor(this.score),
      maxLength: this.maxLengthReached,
      maxLayers: this.getUnlockedLayersCount(),
      anomalies: this.levelManager.totalAnomaliesResolved
    });
  }
}

// Boot game on window load
window.addEventListener('load', () => {
  new GameController();
});
