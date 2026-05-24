import * as PIXI from 'pixi.js';
import { Snake } from './game/Snake';
import { Renderer3D } from './game/Renderer3D';
import { LevelManager } from './game/LevelManager';
import { CollisionSystem } from './game/CollisionSystem';
import { SoundEffects } from './game/SoundEffects';
import { UI } from './game/UI';
import { CONFIG, GameState, Point3D, PlayMode } from './game/Types';

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

  // 2-Player Versus properties
  private mode: PlayMode = 'SINGLE';
  private snake2?: Snake;
  private score2: number = 0;
  private scoreMultiplier2: number = 1.0;
  private maxLengthReached2: number = CONFIG.INITIAL_SNAKE_LENGTH;
  private p1RewindTimer: number = 0;
  private p2RewindTimer: number = 0;

  constructor() {
    this.initPixi();
    this.sfx = new SoundEffects();
    this.levelManager = new LevelManager();
    this.collisionSystem = new CollisionSystem();
    this.ui = new UI(
      (mode) => this.startGame(mode),
      () => { this.state = 'MENU'; },
      this.sfx
    );

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
        const layers = this.getUnlockedLayersCount();
        if (this.mode === 'SINGLE') {
          // Single player dimension controls (E/Space for UP, Q/Shift for DOWN)
          if (e.code === 'KeyE' || e.code === 'Space') {
            this.snake.shiftDimension('UP', layers, this.sfx);
            this.sfx.setDimensionHum(this.snake.head.z);
          } else if (e.code === 'KeyQ' || e.shiftKey || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            this.snake.shiftDimension('DOWN', layers, this.sfx);
            this.sfx.setDimensionHum(this.snake.head.z);
          }
        } else {
          // Versus Mode: Player 1 uses Q / E
          if (e.code === 'KeyE' && this.p1RewindTimer <= 0) {
            this.snake.shiftDimension('UP', layers, this.sfx);
          } else if (e.code === 'KeyQ' && this.p1RewindTimer <= 0) {
            this.snake.shiftDimension('DOWN', layers, this.sfx);
          }

          // Versus Mode: Player 2 uses Comma / Period
          if (this.snake2 && this.p2RewindTimer <= 0) {
            if (e.code === 'Period') {
              this.snake2.shiftDimension('UP', layers, this.sfx);
            } else if (e.code === 'Comma') {
              this.snake2.shiftDimension('DOWN', layers, this.sfx);
            }
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  private startGame(mode: PlayMode = 'SINGLE') {
    this.sfx.enableAudio();
    this.state = 'PLAYING';
    this.mode = mode;

    this.ui.setPlayMode(mode);

    // Create new player timeline snakes with dynamic starting X based on length
    const startX = Math.max(150, Math.min(500, CONFIG.INITIAL_SNAKE_LENGTH * CONFIG.NODE_SPACING * 1.5 + 50));
    
    if (mode === 'SINGLE') {
      this.snake = new Snake(startX, CONFIG.GAME_HEIGHT / 2, 0, 'CYAN');
      this.snake2 = undefined;
    } else {
      // Split Y-positions slightly so they don't spawn exactly on top of each other
      this.snake = new Snake(startX, CONFIG.GAME_HEIGHT / 2 - 55, 0, 'CYAN');
      this.snake2 = new Snake(startX, CONFIG.GAME_HEIGHT / 2 + 55, 0, 'PINK');
    }
    
    this.sfx.setDimensionHum(0);

    // Reset components and stats
    this.levelManager.reset();
    this.score = 0;
    this.score2 = 0;
    this.spawnGraceTimer = 5.0;
    this.scoreMultiplier = 1.0;
    this.scoreMultiplier2 = 1.0;
    this.maxLengthReached = CONFIG.INITIAL_SNAKE_LENGTH;
    this.maxLengthReached2 = CONFIG.INITIAL_SNAKE_LENGTH;
    this.p1RewindTimer = 0;
    this.p2RewindTimer = 0;
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
    const len1 = this.snake.length;
    const len2 = this.snake2 ? this.snake2.length : 0;
    const maxLen = Math.max(len1, len2);
    // Perfect square formula starting at L = 4 (n >= 2)
    if (maxLen < 4) return 1;
    return Math.floor(Math.sqrt(maxLen));
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
    let dx1 = 0, dy1 = 0;
    let dx2 = 0, dy2 = 0;

    // Player 1 controls (WASD)
    if (this.keys['KeyW']) dy1 -= 1;
    if (this.keys['KeyS']) dy1 += 1;
    if (this.keys['KeyA']) dx1 -= 1;
    if (this.keys['KeyD']) dx1 += 1;

    // Player 2 controls (Arrows)
    if (this.keys['ArrowUp']) dy2 -= 1;
    if (this.keys['ArrowDown']) dy2 += 1;
    if (this.keys['ArrowLeft']) dx2 -= 1;
    if (this.keys['ArrowRight']) dx2 += 1;

    // Standardize diagonal velocity vectors
    if (dx1 !== 0 && dy1 !== 0) { dx1 *= 0.7071; dy1 *= 0.7071; }
    if (dx2 !== 0 && dy2 !== 0) { dx2 *= 0.7071; dy2 *= 0.7071; }

    const unlockedLayers = this.getUnlockedLayersCount();

    // -------------------------------------------------------------
    // MOVEMENT & POSITION UPDATES
    // -------------------------------------------------------------
    if (this.mode === 'SINGLE') {
      let dx = dx1 + dx2;
      let dy = dy1 + dy2;
      if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

      if (this.p1RewindTimer <= 0) {
        this.snake.scrollHistory(scrollSpeed * dt);
        if (dx !== 0 || dy !== 0) {
          this.snake.move(dx, dy);
        } else {
          this.snake.idleUpdate();
        }
      }
    } else {
      // Versus Mode: Player 1 (WASD)
      if (this.p1RewindTimer <= 0) {
        this.snake.scrollHistory(scrollSpeed * dt);
        if (dx1 !== 0 || dy1 !== 0) {
          this.snake.move(dx1, dy1);
        } else {
          this.snake.idleUpdate();
        }
      }

      // Versus Mode: Player 2 (Arrows)
      if (this.snake2 && this.p2RewindTimer <= 0) {
        this.snake2.scrollHistory(scrollSpeed * dt);
        if (dx2 !== 0 || dy2 !== 0) {
          this.snake2.move(dx2, dy2);
        } else {
          this.snake2.idleUpdate();
        }
      }
    }

    // Update trailing chronal particles
    this.snake.updateParticles(dt, scrollSpeed * dt);
    if (this.mode === 'VERSUS' && this.snake2) {
      this.snake2.updateParticles(dt, scrollSpeed * dt);
    }

    // -------------------------------------------------------------
    // INDIVIDUAL REWIND TIMERS
    // -------------------------------------------------------------
    if (this.p1RewindTimer > 0) {
      this.p1RewindTimer -= dt;
      if (this.p1RewindTimer <= 0) {
        this.executeRewindPenalty(this.snake, 1);
      }
    }
    if (this.p2RewindTimer > 0) {
      this.p2RewindTimer -= dt;
      if (this.p2RewindTimer <= 0 && this.snake2) {
        this.executeRewindPenalty(this.snake2, 2);
      }
    }

    // Calculate activeWidth of the playable timeline zone dynamically
    const maxLen = this.snake2 ? Math.max(this.snake.length, this.snake2.length) : this.snake.length;
    const activeWidth = Math.min(CONFIG.GAME_WIDTH, Math.max(180, (maxLen / 16) * CONFIG.GAME_WIDTH));

    // Update level elements (move and spawn obstacles/essences at activeWidth)
    this.levelManager.update(scrollSpeed, unlockedLayers, dt, this.sfx, activeWidth);

    // 3. Collision Checks & State Resolutions
    this.checkCollisions();

    // 4. Fail / Win Checks
    if (this.spawnGraceTimer <= 0) {
      if (this.mode === 'SINGLE') {
        if (this.snake.isTailOut() || this.snake.length < 3) {
          this.triggerGameOver("Timeline collapsed! Your snake tail was forced past the Left Present line (Death Line).");
          return;
        }
      } else {
        // Player 1 death
        const p1Dead = (this.snake.isTailOut() || this.snake.length < 3) && this.p1RewindTimer <= 0;
        // Player 2 death
        const p2Dead = this.snake2 && (this.snake2.isTailOut() || this.snake2.length < 3) && this.p2RewindTimer <= 0;

        if (p1Dead && p2Dead) {
          this.triggerVersusEnd('DRAW', "Double collapse! Both player timelines collapsed past the Left Present boundary.");
          return;
        } else if (p1Dead) {
          this.triggerVersusEnd('P2', "Player 1 suffered chronological collapse! Player 2 timeline stabilized.");
          return;
        } else if (p2Dead) {
          this.triggerVersusEnd('P1', "Player 2 suffered chronological collapse! Player 1 timeline stabilized.");
          return;
        }
      }
    }

    // Victory conditions
    if (this.mode === 'SINGLE') {
      if (this.snake.length >= CONFIG.VICTORY_LENGTH) {
        this.triggerVictory();
        return;
      }
    } else {
      const p1Wins = this.snake.length >= CONFIG.VICTORY_LENGTH;
      const p2Wins = this.snake2 && this.snake2.length >= CONFIG.VICTORY_LENGTH;

      if (p1Wins && p2Wins) {
        this.triggerVersusEnd('DRAW', "Synchronized Stabilization! Both players successfully stabilized the timeline together!");
        return;
      } else if (p1Wins) {
        this.triggerVersusEnd('P1', "Player 1 stabilized the timeline and achieved ultimate chronological victory!");
        return;
      } else if (p2Wins) {
        this.triggerVersusEnd('P2', "Player 2 stabilized the timeline and achieved ultimate chronological victory!");
        return;
      }
    }

    // 5. Drawing Layers
    // Draw stacked grid timeline backgrounds based on Player 1's active layer (or base layer)
    this.renderer3D.drawGrids(this.backgroundGraphics, unlockedLayers, this.scrollOffset, maxLen, this.snake.head.z);

    this.gameplayGraphics.clear();
    this.levelManager.draw(this.gameplayGraphics, this.renderer3D);
    
    // Draw Player 1
    if (this.p1RewindTimer <= 0 || Math.floor(this.p1RewindTimer / 4) % 2 === 0) {
      this.snake.draw(this.gameplayGraphics, this.renderer3D, this.spawnGraceTimer > 0);
    }
    
    // Draw Player 2 (Versus Mode)
    if (this.mode === 'VERSUS' && this.snake2) {
      if (this.p2RewindTimer <= 0 || Math.floor(this.p2RewindTimer / 4) % 2 === 0) {
        this.snake2.draw(this.gameplayGraphics, this.renderer3D, this.spawnGraceTimer > 0);
      }
    }

    // 6. Update HUD Stats
    if (this.mode === 'SINGLE') {
      this.ui.updateHUD(
        Math.floor(this.score),
        this.scoreMultiplier,
        this.snake.length,
        this.levelManager.getElapsedTime(),
        unlockedLayers
      );
    } else {
      this.ui.updateHUD(
        Math.floor(this.score),
        this.scoreMultiplier,
        this.snake.length,
        this.levelManager.getElapsedTime(),
        unlockedLayers,
        Math.floor(this.score2),
        this.snake2 ? this.snake2.length : 0
      );
    }

    this.ui.updateImmunity(this.spawnGraceTimer);
    this.ui.updateAlerts(this.levelManager.activeCascades);
  }

  private checkCollisions() {
    // -------------------------------------------------------------
    // PLAYER 1 COLLISIONS
    // -------------------------------------------------------------
    if (this.p1RewindTimer <= 0) {
      // Collect Time Essences (System A)
      const essence = this.collisionSystem.checkHeadEssenceCollisions(this.snake, this.levelManager.entities);
      if (essence) {
        this.levelManager.removeEntity(essence.id);
        this.snake.grow();
        this.sfx.playCollect();

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
          this.score += 800 * this.scoreMultiplier;
          this.sfx.playCascadeCleared();
        } else {
          this.score += 1800 * this.scoreMultiplier;
          this.sfx.playCascadeCleared();
          this.levelManager.entities = this.levelManager.entities.filter(
            e => !(e.type === 'PROJECTILE' && e.z === 0)
          );
        }
        this.scoreMultiplier = Math.min(4.0, this.scoreMultiplier + 0.4);
      }
    }

    // -------------------------------------------------------------
    // PLAYER 2 COLLISIONS (Versus Mode)
    // -------------------------------------------------------------
    if (this.mode === 'VERSUS' && this.snake2 && this.p2RewindTimer <= 0) {
      // Collect Time Essences (System A)
      const essence2 = this.collisionSystem.checkHeadEssenceCollisions(this.snake2, this.levelManager.entities);
      if (essence2) {
        this.levelManager.removeEntity(essence2.id);
        this.snake2.grow();
        this.sfx.playCollect();

        if (this.snake2.length > this.maxLengthReached2) {
          this.maxLengthReached2 = this.snake2.length;
        }

        this.score2 += 100 * this.scoreMultiplier2;
        this.scoreMultiplier2 = Math.min(4.0, this.scoreMultiplier2 + 0.1);
      }

      // Upstream Prerequisite Spawners ramming (Intervention Law)
      const prereq2 = this.collisionSystem.checkHeadObstacleCollisions(this.snake2, this.levelManager.entities);
      if (prereq2 && prereq2.type === 'PREREQUISITE') {
        this.levelManager.removeEntity(prereq2.id);
        this.levelManager.totalAnomaliesResolved++;

        if (prereq2.hasCascaded) {
          this.score2 += 800 * this.scoreMultiplier2;
          this.sfx.playCascadeCleared();
        } else {
          this.score2 += 1800 * this.scoreMultiplier2;
          this.sfx.playCascadeCleared();
          this.levelManager.entities = this.levelManager.entities.filter(
            e => !(e.type === 'PROJECTILE' && e.z === 0)
          );
        }
        this.scoreMultiplier2 = Math.min(4.0, this.scoreMultiplier2 + 0.4);
      }
    }

    // Bypassing dangerous collisions during spawn invincibility grace period
    if (this.spawnGraceTimer > 0) {
      return;
    }

    // -------------------------------------------------------------
    // PLAYER 1 DANGEROUS COLLISIONS
    // -------------------------------------------------------------
    if (this.p1RewindTimer <= 0) {
      const headHit = this.collisionSystem.checkHeadObstacleCollisions(this.snake, this.levelManager.entities);
      const bodyHit = this.collisionSystem.checkBodyObstacleCollisions(this.snake, this.levelManager.entities);
      const selfHit = this.collisionSystem.checkSelfCollision(this.snake);

      if (headHit || bodyHit || selfHit) {
        if (this.mode === 'SINGLE') {
          this.triggerRewind();
        } else {
          this.triggerIndividualRewind(1);
        }
      }
    }

    // -------------------------------------------------------------
    // PLAYER 2 DANGEROUS COLLISIONS (Versus Mode)
    // -------------------------------------------------------------
    if (this.mode === 'VERSUS' && this.snake2 && this.p2RewindTimer <= 0) {
      const headHit2 = this.collisionSystem.checkHeadObstacleCollisions(this.snake2, this.levelManager.entities);
      const bodyHit2 = this.collisionSystem.checkBodyObstacleCollisions(this.snake2, this.levelManager.entities);
      const selfHit2 = this.collisionSystem.checkSelfCollision(this.snake2);

      if (headHit2 || bodyHit2 || selfHit2) {
        this.triggerIndividualRewind(2);
      }
    }

    // -------------------------------------------------------------
    // CROSS PLAYER COLLISIONS (Versus Mode)
    // -------------------------------------------------------------
    if (this.mode === 'VERSUS' && this.snake2) {
      if (this.p1RewindTimer <= 0 && this.p2RewindTimer <= 0) {
        // Head-to-Head crash
        if (this.snake.head.z === this.snake2.head.z) {
          const dx = this.snake.head.x - this.snake2.head.x;
          const dy = this.snake.head.y - this.snake2.head.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 16) {
            this.triggerIndividualRewind(1);
            this.triggerIndividualRewind(2);
            return;
          }
        }

        // P1 Head vs P2 Body segments
        for (const segment of this.snake2.body) {
          if (this.snake.head.z === segment.z) {
            const dx = this.snake.head.x - segment.x;
            const dy = this.snake.head.y - segment.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 12) {
              this.triggerIndividualRewind(1);
              break;
            }
          }
        }

        // P2 Head vs P1 Body segments
        for (const segment of this.snake.body) {
          if (this.snake2.head.z === segment.z) {
            const dx = this.snake2.head.x - segment.x;
            const dy = this.snake2.head.y - segment.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 12) {
              this.triggerIndividualRewind(2);
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Trigger individual chronal rewind retraction sequence
   */
  private triggerIndividualRewind(playerNum: number) {
    this.sfx.playRewind();
    const snake = playerNum === 1 ? this.snake : this.snake2;
    if (!snake) return;

    const severCount = Math.max(3, Math.round(snake.length * 0.2));
    
    if (playerNum === 1) {
      this.p1RewindTimer = 45;
      this.scoreMultiplier = 1.0;
    } else {
      this.p2RewindTimer = 45;
      this.scoreMultiplier2 = 1.0;
    }

    this.ui.showRewind(severCount);
    // Hide rewind banner overlay after 1 second automatically
    setTimeout(() => {
      this.ui.hideRewind();
    }, 750);
  }

  /**
   * Execute individual chronal rewind retraction penalty
   */
  private executeRewindPenalty(snake: Snake, playerNum: number) {
    const severCount = Math.max(3, Math.round(snake.length * 0.2));
    const targetLength = snake.length - severCount;

    if (targetLength < 3) {
      if (playerNum === 1) {
        this.triggerVersusEnd('P2', "Player 1 suffered chronological collapse (Length < 3) during rewind!");
      } else {
        this.triggerVersusEnd('P1', "Player 2 suffered chronological collapse (Length < 3) during rewind!");
      }
      return;
    }

    const layersAfter = this.getUnlockedLayersCount();
    let safePos: Point3D = { x: 50, y: CONFIG.GAME_HEIGHT / 2, z: 0 };

    if (snake.body.length > severCount) {
      safePos = { ...snake.body[severCount] };
    }
    safePos.z = Math.min(safePos.z, layersAfter - 1);

    if (safePos.x <= 10) {
      if (playerNum === 1) {
        this.triggerVersusEnd('P2', "Player 1's safe rewind coordinates lay outside the Present boundary.");
      } else {
        this.triggerVersusEnd('P1', "Player 2's safe rewind coordinates lay outside the Present boundary.");
      }
      return;
    }

    // Shrink and reposition
    snake.rewindShrink(severCount, layersAfter);
    snake.forcePosition(safePos, layersAfter);

    if (playerNum === 1) {
      this.sfx.setDimensionHum(this.snake.head.z);
    } else if (this.snake2) {
      this.sfx.setDimensionHum(this.snake2.head.z);
    }

    // Clean hazards around safe spawn
    this.levelManager.entities = this.levelManager.entities.filter(
      e => !(Math.abs(e.x - safePos.x) < 120 && Math.abs(e.y - safePos.y) < 120 && e.z === safePos.z)
    );
  }

  /**
   * Execute global Chronal Rewind sequence
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
    this.snake.updateParticles(dt, 0);
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

  private triggerVictory(cause?: string) {
    this.state = 'VICTORY';
    this.sfx.playVictory();

    // Bonus points for excess length
    const lengthBonus = (this.snake.length - 16) * 500;
    this.score += lengthBonus;

    const summaryText = cause || "Congratulations! You successfully survived the temporal anomaly stream and completed the level.";

    this.ui.showVictory({
      score: Math.floor(this.score),
      maxLength: this.maxLengthReached,
      maxLayers: this.getUnlockedLayersCount(),
      anomalies: this.levelManager.totalAnomaliesResolved
    });

    if (cause) {
      const summaryCause = document.querySelector('#victory-screen .summary-cause');
      if (summaryCause) {
        summaryCause.textContent = summaryText;
      }
    }
  }

  private triggerVersusEnd(winner: 'P1' | 'P2' | 'DRAW', cause: string) {
    this.state = 'VICTORY';
    this.sfx.playVictory();
    
    const p1Stats = {
      score: this.score,
      maxLength: this.maxLengthReached,
      isStabilized: winner === 'P1' || (winner === 'DRAW' && this.snake.length >= 3 && !this.snake.isTailOut())
    };

    const p2Stats = {
      score: this.score2,
      maxLength: this.maxLengthReached2,
      isStabilized: winner === 'P2' || (winner === 'DRAW' && this.snake2 !== undefined && this.snake2.length >= 3 && !this.snake2.isTailOut())
    };

    if (winner === 'P1') {
      p1Stats.isStabilized = true;
      p2Stats.isStabilized = false;
    } else if (winner === 'P2') {
      p1Stats.isStabilized = false;
      p2Stats.isStabilized = true;
    }

    this.ui.showVersusResults(winner, cause, p1Stats, p2Stats);
  }
}

// Boot game on window load
window.addEventListener('load', () => {
  new GameController();
});
