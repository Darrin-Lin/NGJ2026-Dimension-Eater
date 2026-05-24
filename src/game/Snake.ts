import * as PIXI from 'pixi.js';
import { Point3D, CONFIG } from './Types';
import { Renderer3D } from './Renderer3D';
import { SoundEffects } from './SoundEffects';

export class Snake {
  public head: Point3D;
  public body: Point3D[] = [];
  public length: number = CONFIG.INITIAL_SNAKE_LENGTH;

  // History queue to store exact historical 3D path of the head
  private history: Point3D[] = [];

  // Track target layer and transitions
  private targetLayer: number = 0;

  public colorTheme: 'CYAN' | 'PINK' = 'CYAN';

  private particles: Array<{
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    decay: number;
    color: number;
  }> = [];

  constructor(startX: number, startY: number, startZ: number, colorTheme: 'CYAN' | 'PINK' = 'CYAN') {
    this.head = { x: startX, y: startY, z: startZ };
    this.targetLayer = startZ;
    this.colorTheme = colorTheme;

    // Pre-fill history so body nodes start in line behind the head
    const totalTicksNeeded = CONFIG.INITIAL_SNAKE_LENGTH * CONFIG.NODE_SPACING;
    for (let i = 0; i < totalTicksNeeded; i++) {
      this.history.push({
        x: Math.max(20, startX - i * 1.5),
        y: startY,
        z: startZ
      });
    }
    this.updateBodyPositions();
  }

  /**
   * Shift all cached movement history coordinates left to align with the forced horizontal side-scroll
   */
  public scrollHistory(scrollSpeed: number) {
    // Shifting history ensures the body scrolls with the coordinate system
    for (let i = 0; i < this.history.length; i++) {
      this.history[i].x -= scrollSpeed;
    }

    // Also scroll the head if player is not inputting movement, to represent scrolling drag
    this.head.x -= scrollSpeed;
  }

  /**
   * Handle user movement input on the current layer
   */
  public move(dx: number, dy: number) {
    // Dynamic temporal speed acceleration based on length
    const speed = CONFIG.SNAKE_SPEED + (this.length - 3) * 0.8;

    // Normal WASD/Arrow movement
    this.head.x += dx * speed;
    this.head.y += dy * speed;

    // 1. Enforce logical bounds
    // Y bounds (Space Axis)
    this.head.y = Math.max(10, Math.min(CONFIG.GAME_HEIGHT - 10, this.head.y));

    // X bounds (Time Axis)
    // Left boundary (The Present / Death Line)
    this.head.x = Math.max(0, this.head.x);

    // Right boundary (Horizon / Future Reach)
    // For L < 16, the max horizontal reach is capped: X_limit = ScreenWidth * (L / 16)
    // At L >= 16, lock is released up to the physical GAME_WIDTH (deep horizon)
    let maxX = CONFIG.GAME_WIDTH;
    if (this.length < 16) {
      maxX = (this.length / 16) * CONFIG.GAME_WIDTH;
    }
    this.head.x = Math.min(maxX, this.head.x);

    // 2. Record new head position to history
    this.history.unshift({ x: this.head.x, y: this.head.y, z: this.head.z });

    // Truncate history to save memory and avoid infinite growth
    const maxHistoryNeeded = (this.length + 5) * CONFIG.NODE_SPACING;
    if (this.history.length > maxHistoryNeeded) {
      this.history.length = maxHistoryNeeded;
    }

    this.updateBodyPositions();
  }

  /**
   * Shift the head vertically to another Z-Dimension layer
   */
  public shiftDimension(direction: 'UP' | 'DOWN', unlockedLayersCount: number, sfx: SoundEffects) {
    if (direction === 'UP') {
      if (this.targetLayer < unlockedLayersCount - 1) {
        this.targetLayer++;
        this.head.z = this.targetLayer;
        sfx.playShift();
      }
    } else {
      if (this.targetLayer > 0) {
        this.targetLayer--;
        this.head.z = this.targetLayer;
        sfx.playShift();
      }
    }
  }

  /**
   * Update the body coordinates by grabbing nodes from the historical queue at spaced intervals
   */
  private updateBodyPositions() {
    this.body = [];
    for (let i = 0; i < this.length; i++) {
      const histIdx = i * CONFIG.NODE_SPACING;
      // Safeguard against index overflow
      if (histIdx < this.history.length) {
        // Clone historical coordinates
        this.body.push({
          x: this.history[histIdx].x,
          y: this.history[histIdx].y,
          z: this.history[histIdx].z
        });
      } else {
        // Fallback if history is too short (e.g. initial setup)
        const lastHist = this.history[this.history.length - 1];
        this.body.push({ ...lastHist });
      }
    }
  }

  /**
   * Perform trailing idle update when player provides no directional inputs
   */
  public idleUpdate() {
    // Even when idle, the head position must be logged to history so the trail continues to track correctly
    this.history.unshift({ x: this.head.x, y: this.head.y, z: this.head.z });

    const maxHistoryNeeded = (this.length + 5) * CONFIG.NODE_SPACING;
    if (this.history.length > maxHistoryNeeded) {
      this.history.length = maxHistoryNeeded;
    }

    this.updateBodyPositions();
  }

  /**
   * Update and scroll the particle systems trailing around the snake body
   */
  public updateParticles(dt: number, scrollOffset: number) {
    // 1. Move and scroll existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x -= scrollOffset; // Move left with grid scrolling
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;

      // Remove dead or offscreen particles
      if (p.alpha <= 0 || p.x < -20) {
        this.particles.splice(i, 1);
      }
    }

    // 2. Emit new chronal spark particles
    // Emit from head
    if (Math.random() < 0.45) {
      this.spawnParticle(this.head.x, this.head.y, this.head.z, true);
    }

    // Emit from body nodes
    if (this.body.length > 0 && Math.random() < 0.55) {
      const randomSeg = this.body[Math.floor(Math.random() * this.body.length)];
      this.spawnParticle(randomSeg.x, randomSeg.y, randomSeg.z, false);
    }
  }

  private spawnParticle(x: number, y: number, z: number, isHead: boolean) {
    const angle = Math.random() * Math.PI * 2;
    const speed = isHead ? (Math.random() * 0.9 + 0.5) : (Math.random() * 0.4 + 0.15);
    const vx = Math.cos(angle) * speed - 0.25; // Drifts slightly left
    const vy = Math.sin(angle) * speed;

    this.particles.push({
      x,
      y,
      z,
      vx,
      vy,
      size: isHead ? (Math.random() * 3 + 2.5) : (Math.random() * 2 + 1.2),
      alpha: 1.0,
      decay: Math.random() * 0.025 + 0.015,
      color: this.getSnakeColor(z)
    });
  }

  /**
   * Colliding with a Time Essence increases body node length permanently by 1
   */
  public grow() {
    this.length++;

    // Add additional history padding so new node has segment coordinates available
    const lastHist = this.history[this.history.length - 1] || this.head;
    for (let i = 0; i < CONFIG.NODE_SPACING; i++) {
      this.history.push({
        x: lastHist.x - i * 1,
        y: lastHist.y,
        z: lastHist.z
      });
    }
    this.updateBodyPositions();
  }

  /**
   * Truncate the snake tail segments due to a temporal collision rewind penalty
   */
  public rewindShrink(severCount: number, unlockedLayersCount: number) {
    this.length = Math.max(1, this.length - severCount);

    // Slice history queue
    const maxHist = (this.length + 2) * CONFIG.NODE_SPACING;
    if (this.history.length > maxHist) {
      this.history.length = maxHist;
    }

    // Clamp all history elements to the new unlocked layers count!
    for (let i = 0; i < this.history.length; i++) {
      this.history[i].z = Math.min(this.history[i].z, unlockedLayersCount - 1);
    }

    // Adjust target layers if current dimension was locked by the shrink
    if (this.targetLayer >= unlockedLayersCount) {
      this.targetLayer = unlockedLayersCount - 1;
      this.head.z = this.targetLayer;
    }

    this.updateBodyPositions();
  }

  /**
   * Reset head coordinates to a specific safe historic node position during rewind
   */
  public forcePosition(pos: Point3D, unlockedLayersCount: number) {
    const clampedZ = Math.min(pos.z, unlockedLayersCount - 1);
    this.head = { x: pos.x, y: pos.y, z: clampedZ };
    this.targetLayer = clampedZ;

    // Reset history queue behind this new position
    this.history = [];
    const totalTicks = this.length * CONFIG.NODE_SPACING;
    for (let i = 0; i < totalTicks; i++) {
      this.history.push({
        x: Math.max(20, pos.x - i * 1.5),
        y: pos.y,
        z: clampedZ
      });
    }
    this.updateBodyPositions();
  }

  /**
   * Check if the tail is forced past the left boundary
   */
  public isTailOut(): boolean {
    if (this.body.length === 0) return false;
    const tail = this.body[this.body.length - 1];
    return tail.x < -15; // 15px off-screen buffer for player comfort and safety
  }

  public getSnakeColor(z: number): number {
    if (this.colorTheme === 'CYAN') {
      const colors = [0x00f0ff, 0x00ff80, 0x0080ff, 0xffff00];
      return colors[z % colors.length];
    } else {
      const colors = [0xff0055, 0xff00ff, 0xbf00ff, 0xff8000];
      return colors[z % colors.length];
    }
  }

  /**
   * Render the glowing temporal snake chain on screen using Renderer3D projection
   */
  public draw(graphics: PIXI.Graphics, renderer: Renderer3D, isInvincible: boolean = false) {
    if (this.body.length === 0) return;

    // Pulse effect during starting invincibility
    const invAlphaMod = isInvincible ? (0.4 + 0.35 * Math.sin(Date.now() / 80)) : 1.0;

    // 1. Draw glowing connecting lines between body nodes
    for (let i = 0; i < this.body.length - 1; i++) {
      const nodeA = this.body[i];
      const nodeB = this.body[i + 1];

      const pA = renderer.toScreen(nodeA);
      const pB = renderer.toScreen(nodeB);

      if (nodeA.z === nodeB.z) {
        // Same dimension connector
        const color = this.getSnakeColor(nodeA.z);
        graphics.lineStyle(4, color, 0.7 * invAlphaMod);
        graphics.moveTo(pA.x, pA.y);
        graphics.lineTo(pB.x, pB.y);
      } else {
        // Dimension transition connector (draw glowing vertical dotted pipeline)
        graphics.lineStyle(2, 0xffffff, 0.4 * invAlphaMod);

        // Custom dotted line formula
        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dots = Math.max(5, Math.floor(dist / 8));

        for (let j = 0; j < dots; j += 2) {
          const t1 = j / dots;
          const t2 = (j + 1) / dots;
          graphics.moveTo(pA.x + dx * t1, pA.y + dy * t1);
          graphics.lineTo(pA.x + dx * t2, pA.y + dy * t2);
        }
      }
    }

    // 2. Draw body nodes. Nodes glow based on their active dimension
    for (let i = 1; i < this.body.length; i++) {
      const node = this.body[i];
      const p = renderer.toScreen(node);
      const color = this.getSnakeColor(node.z);

      // Fade body color towards tail
      const progress = i / this.body.length;
      const alpha = 0.85 * (1 - progress * 0.6) * invAlphaMod;
      const radius = 6 * (1 - progress * 0.4);

      graphics.lineStyle(1.5, 0xffffff, alpha * 0.5);
      graphics.beginFill(color, alpha);
      graphics.drawCircle(p.x, p.y, radius);
      graphics.endFill();
    }

    // 3. Draw head node as a gorgeous temporal crystal node
    const headPt = renderer.toScreen(this.head);
    const headColor = this.getSnakeColor(this.head.z);

    // Glowing outer halo
    graphics.lineStyle(0);
    graphics.beginFill(headColor, 0.3 * invAlphaMod);
    graphics.drawCircle(headPt.x, headPt.y, 14);
    graphics.endFill();

    // Central diamond shape
    graphics.lineStyle(2.5, 0xffffff, 0.95 * invAlphaMod);
    graphics.beginFill(headColor, 0.9 * invAlphaMod);

    graphics.moveTo(headPt.x, headPt.y - 9);  // Top
    graphics.lineTo(headPt.x + 9, headPt.y);  // Right
    graphics.lineTo(headPt.x, headPt.y + 9);  // Bottom
    graphics.lineTo(headPt.x - 9, headPt.y);  // Left
    graphics.closePath();
    graphics.endFill();

    // Inner bright core
    graphics.beginFill(0xffffff, 0.95 * invAlphaMod);
    graphics.drawCircle(headPt.x, headPt.y, 3);
    graphics.endFill();

    // 4. Render glowing chronal trail particles
    for (const p of this.particles) {
      const pPt = renderer.toScreen(p);
      const alpha = p.alpha * invAlphaMod;

      // Draw particle circle
      graphics.lineStyle(0);
      graphics.beginFill(p.color, alpha * 0.85);
      graphics.drawCircle(pPt.x, pPt.y, p.size);
      graphics.endFill();

      // Bright white inner core for larger head sparks
      if (p.size > 3) {
        graphics.beginFill(0xffffff, alpha * 0.9);
        graphics.drawCircle(pPt.x, pPt.y, p.size * 0.4);
        graphics.endFill();
      }
    }
  }
}
