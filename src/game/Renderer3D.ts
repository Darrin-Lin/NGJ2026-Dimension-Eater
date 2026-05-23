import * as PIXI from 'pixi.js';
import { Point3D, CONFIG } from './Types';

export class Renderer3D {
  private app: PIXI.Application;
  private width: number = window.innerWidth;
  private height: number = window.innerHeight;

  // Projection configuration
  private scaleX: number = 1;
  private scaleY: number = 1;
  private baseLeft: number = 80;
  private baseTop: number = 480;

  // Track active stack state dynamically (queried by toScreen)
  public unlockedCount: number = 1;
  public activeZ: number = 0;

  // Visual offsets for stacked layers (base config)
  private layerXOffset: number = 90;

  // Theme colors per layer (supports endlessly cycling layers)
  private layerColors: number[] = [
    0x00f0ff, // Layer 0: Neon Cyan
    0xbf00ff, // Layer 1: Neon Purple/Violet
    0xff8000, // Layer 2: Neon Golden Orange
    0x00ff80, // Layer 3: Neon Sea Green
    0xff00ff, // Layer 4: Neon Magenta
    0xffff00, // Layer 5: Neon Yellow
    0x0080ff, // Layer 6: Neon Royal Blue
    0xff0055  // Layer 7: Neon Deep Pink
  ];

  constructor(app: PIXI.Application) {
    this.app = app;
    this.updateDimensions();
  }

  public updateDimensions() {
    this.width = this.app.screen.width;
    this.height = this.app.screen.height;

    // Dynamically calculate scales to keep the logical board centered
    this.scaleX = (this.width - 250) / CONFIG.GAME_WIDTH;
    this.scaleY = (this.height - 350) / CONFIG.GAME_HEIGHT;

    // Constrain scale to reasonable values
    this.scaleX = Math.max(0.4, Math.min(1.2, this.scaleX));
    this.scaleY = Math.max(0.4, Math.min(1.2, this.scaleY));

    // Place the base layer near the bottom-left area of screen
    this.baseLeft = (this.width - (CONFIG.GAME_WIDTH * this.scaleX + 2 * this.layerXOffset)) / 2 - 20;
    this.baseTop = this.height - 180 - (CONFIG.GAME_HEIGHT * this.scaleY);
  }

  /**
   * Map logical layer index to slot offsets based on active carousel focus
   */
  public getSlotOffsets(z: number) {
    const N = this.unlockedCount;
    const A = this.activeZ;
    if (N === 1) return { x: 0, y: 0 };

    const diff = (A - z + N) % N;
    let slot = 1;
    if (diff === 0) {
      slot = 1; // active layer (second slot / focus)
    } else if (diff === N - 1) {
      slot = 0; // foreground layer
    } else {
      slot = diff + 1; // background layers
    }

    if (slot === 1) {
      // Active layer: focus in the middle
      return { x: 0, y: 0 };
    } else if (slot === 0) {
      // Foreground layer: slightly shifted forward
      return { x: -60, y: 140 };
    } else {
      // Background layers: stacked upwards with logarithmic decay
      const k = slot - 1; // background level index 1, 2, 3...
      const xOff = 90 + 40 * Math.log2(k);
      const yOff = -150 - 90 * Math.log2(k);
      return { x: xOff, y: yOff };
    }
  }

  /**
   * Project a 3D logical coordinate to a 2D screen coordinate using dynamic focus stacking
   */
  public toScreen(pt: Point3D): PIXI.Point {
    const offsets = this.getSlotOffsets(pt.z);
    const rx = this.baseLeft + (pt.x * this.scaleX) + (offsets.x * this.scaleX);
    const ry = this.baseTop + (pt.y * this.scaleY) + (offsets.y * this.scaleY);
    return new PIXI.Point(rx, ry);
  }

  /**
   * Get the theme color of a specific layer
   */
  public getLayerColor(layer: number): number {
    return this.layerColors[layer % this.layerColors.length];
  }

  /**
   * Get the list of Z-dimensions in their correct depth sorting order (back-to-front)
   */
  public getDrawOrder(unlockedLayersCount: number, activeLayer: number): number[] {
    const N = unlockedLayersCount;
    if (N === 1) return [0];

    const order: number[] = [];
    // Draw background layers from furthest back to closest background
    // Slots in background are N-1, N-2, ..., 2
    for (let s = N - 1; s >= 2; s--) {
      const z = (activeLayer - (s - 1) + N) % N;
      order.push(z);
    }
    // Draw active layer (Slot 1)
    order.push(activeLayer);
    // Draw foreground layer (Slot 0)
    order.push((activeLayer + 1) % N);

    return order;
  }

  /**
   * Draw the visual background structures (grid planes and connecting portal lines)
   */
  public drawGrids(graphics: PIXI.Graphics, unlockedLayersCount: number, scrollOffset: number, snakeLength: number, activeLayer: number) {
    graphics.clear();

    this.unlockedCount = unlockedLayersCount;
    this.activeZ = activeLayer;

    const maxX = Math.min(CONFIG.GAME_WIDTH, Math.max(180, (snakeLength / 16) * CONFIG.GAME_WIDTH));

    // Get the layers in depth sorted order (draw background layers first, foreground last)
    const layersOrder = this.getDrawOrder(unlockedLayersCount, activeLayer);

    // 1. Draw Vertical Aligners between layers sequentially to assist spatial alignment
    if (unlockedLayersCount > 1) {
      graphics.lineStyle(1, 0xffffff, 0.04);
      for (let x = 0; x <= maxX; x += 200) {
        for (let y = 0; y <= CONFIG.GAME_HEIGHT; y += 100) {
          // Connect consecutive layers in the stack loop
          for (let i = 0; i < unlockedLayersCount - 1; i++) {
            const zA = layersOrder[i];
            const zB = layersOrder[i + 1];
            const pt0 = this.toScreen({ x, y, z: zA });
            const ptMax = this.toScreen({ x, y, z: zB });
            graphics.moveTo(pt0.x, pt0.y);
            graphics.lineTo(ptMax.x, ptMax.y);
          }
        }
      }
    }

    // 2. Draw each layer grid independently in depth-sorted order
    for (const z of layersOrder) {
      const color = this.getLayerColor(z);
      const isFocused = (z === activeLayer);
      
      // Draw grid bounding frame
      graphics.lineStyle(isFocused ? 2.5 : 1.5, color, isFocused ? 0.6 : 0.22);
      graphics.beginFill(0x0e0e1a, isFocused ? 0.22 : 0.08);
      
      const topLeft = this.toScreen({ x: 0, y: 0, z });
      const topRight = this.toScreen({ x: maxX, y: 0, z });
      const bottomRight = this.toScreen({ x: maxX, y: CONFIG.GAME_HEIGHT, z });
      const bottomLeft = this.toScreen({ x: 0, y: CONFIG.GAME_HEIGHT, z });

      graphics.moveTo(topLeft.x, topLeft.y);
      graphics.lineTo(topRight.x, topRight.y);
      graphics.lineTo(bottomRight.x, bottomRight.y);
      graphics.lineTo(bottomLeft.x, bottomLeft.y);
      graphics.closePath();
      graphics.endFill();

      // Draw scrolling grid lines (dimmer on background layers)
      graphics.lineStyle(1, color, isFocused ? 0.12 : 0.05);
      
      // Horizontal lines (representing Y coordinates)
      for (let y = 0; y <= CONFIG.GAME_HEIGHT; y += 50) {
        const start = this.toScreen({ x: 0, y, z });
        const end = this.toScreen({ x: maxX, y, z });
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(end.x, end.y);
      }

      // Vertical scrolling lines (representing X coordinates)
      const gridInterval = 80;
      const startX = -(scrollOffset % gridInterval);
      for (let x = startX; x <= maxX + gridInterval; x += gridInterval) {
        const clampX = Math.max(0, Math.min(maxX, x));
        if (x < 0 || x > maxX) continue;

        const start = this.toScreen({ x: clampX, y: 0, z });
        const end = this.toScreen({ x: clampX, y: CONFIG.GAME_HEIGHT, z });
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(end.x, end.y);
      }

      // 3. Draw bold glowing Present Line (Death Line) on the far left (X = 0) of each layer grid
      graphics.lineStyle(isFocused ? 4 : 2, 0xff3333, isFocused ? 0.95 : 0.4);
      graphics.moveTo(topLeft.x, topLeft.y);
      graphics.lineTo(bottomLeft.x, bottomLeft.y);

      // Draw a subtle "Horizon Lock" line if player hasn't unlocked layer 1 yet
      if (z === 0 && unlockedLayersCount === 1) {
        graphics.lineStyle(2, 0xff007f, 0.6); // pinkish boundary at current maxX
        graphics.moveTo(topRight.x, topRight.y);
        graphics.lineTo(bottomRight.x, bottomRight.y);
      }
    }
  }

  public getScreenScaleX(): number {
    return this.scaleX;
  }
}
