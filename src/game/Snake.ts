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

  constructor(startX: number, startY: number, startZ: number) {
    this.head = { x: startX, y: startY, z: startZ };
    this.targetLayer = startZ;

    // Pre-fill history so body nodes start in line behind the head
    const totalTicksNeeded = CONFIG.INITIAL_SNAKE_LENGTH * CONFIG.NODE_SPACING;
    for (let i = 0; i < totalTicksNeeded; i++) {
      this.history.push({
        x: startX - i * 1.5,
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
    // Normal WASD/Arrow movement
    this.head.x += dx * CONFIG.SNAKE_SPEED;
    this.head.y += dy * CONFIG.SNAKE_SPEED;

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
        x: pos.x - i * 1.5,
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
    return tail.x < 0;
  }

  /**
   * Render the glowing temporal snake chain on screen using Renderer3D projection
   */
  public draw(graphics: PIXI.Graphics, renderer: Renderer3D) {
    if (this.body.length === 0) return;

    // 1. Draw glowing connecting lines between body nodes
    for (let i = 0; i < this.body.length - 1; i++) {
      const nodeA = this.body[i];
      const nodeB = this.body[i + 1];

      const pA = renderer.toScreen(nodeA);
      const pB = renderer.toScreen(nodeB);

      if (nodeA.z === nodeB.z) {
        // Same dimension connector
        const color = renderer.getLayerColor(nodeA.z);
        graphics.lineStyle(4, color, 0.7);
        graphics.moveTo(pA.x, pA.y);
        graphics.lineTo(pB.x, pB.y);
      } else {
        // Dimension transition connector (draw glowing vertical dotted pipeline)
        graphics.lineStyle(2, 0xffffff, 0.4);
        
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
      const color = renderer.getLayerColor(node.z);

      // Fade body color towards tail
      const progress = i / this.body.length;
      const alpha = 0.85 * (1 - progress * 0.6);
      const radius = 6 * (1 - progress * 0.4);

      graphics.lineStyle(1.5, 0xffffff, alpha * 0.5);
      graphics.beginFill(color, alpha);
      graphics.drawCircle(p.x, p.y, radius);
      graphics.endFill();
    }

    // 3. Draw head node as a gorgeous temporal crystal node
    const headPt = renderer.toScreen(this.head);
    const headColor = renderer.getLayerColor(this.head.z);

    // Glowing outer halo
    graphics.lineStyle(0);
    graphics.beginFill(headColor, 0.3);
    graphics.drawCircle(headPt.x, headPt.y, 14);
    graphics.endFill();

    // Central diamond shape
    graphics.lineStyle(2.5, 0xffffff, 0.95);
    graphics.beginFill(headColor, 0.9);
    
    graphics.moveTo(headPt.x, headPt.y - 9);  // Top
    graphics.lineTo(headPt.x + 9, headPt.y);  // Right
    graphics.lineTo(headPt.x, headPt.y + 9);  // Bottom
    graphics.lineTo(headPt.x - 9, headPt.y);  // Left
    graphics.closePath();
    graphics.endFill();

    // Inner bright core
    graphics.beginFill(0xffffff, 0.95);
    graphics.drawCircle(headPt.x, headPt.y, 3);
    graphics.endFill();
  }
}
