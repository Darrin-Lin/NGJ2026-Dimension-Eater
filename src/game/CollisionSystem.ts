import { Snake } from './Snake';
import { GameEntity } from './Types';

export class CollisionSystem {
  constructor() {}

  /**
   * System A: Check if the snake head collides with any Time Essence on its active dimension
   */
  public checkHeadEssenceCollisions(snake: Snake, entities: GameEntity[]): GameEntity | null {
    const head = snake.head;
    const headRadius = 10; // logical radius

    for (const ent of entities) {
      if (ent.type !== 'ESSENCE') continue;

      // Exact matching across all three axes (X, Y, and Z dimension)
      if (head.z === ent.z) {
        const entRadius = ent.width / 2;
        const dx = head.x - ent.x;
        const dy = head.y - ent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (headRadius + entRadius)) {
          return ent;
        }
      }
    }
    return null;
  }

  /**
   * System A: Check if the snake head collides with any dangerous obstacles or projectiles on its active dimension
   */
  public checkHeadObstacleCollisions(snake: Snake, entities: GameEntity[]): GameEntity | null {
    const head = snake.head;
    const headRadius = 8;

    for (const ent of entities) {
      if (ent.type !== 'OBSTACLE' && ent.type !== 'PROJECTILE' && ent.type !== 'PREREQUISITE') continue;

      if (head.z === ent.z) {
        const entRadius = ent.width / 2;
        const dx = head.x - ent.x;
        const dy = head.y - ent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (headRadius + entRadius)) {
          return ent;
        }
      }
    }
    return null;
  }

  /**
   * System B: Check if any part of the lagging snake body collides with center-left zone obstacles
   * Bounding checks require exact layer matches
   */
  public checkBodyObstacleCollisions(snake: Snake, entities: GameEntity[]): GameEntity | null {
    const bodyRadius = 5;

    for (const ent of entities) {
      if (ent.type !== 'OBSTACLE' && ent.type !== 'PROJECTILE') continue;
      
      // LAG-ZONE Constraint: Body collisions represent lagging segment interactions,
      // typically checking coordinates in the center-left area (X <= 750)
      if (ent.x > 750) continue;

      const entRadius = ent.width / 2;

      for (let i = 1; i < snake.body.length; i++) {
        const node = snake.body[i];

        // Exact match across X, Y, and Z layer
        if (node.z === ent.z) {
          const dx = node.x - ent.x;
          const dy = node.y - ent.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < (bodyRadius + entRadius)) {
            return ent; // Return collided obstacle
          }
        }
      }
    }
    return null;
  }

  /**
   * Check if the head collides with its own body (Time Paradox)
   * A paradox is triggered ONLY if coordinates overlap simultaneously in 3D (X, Y, Z)
   */
  public checkSelfCollision(snake: Snake): boolean {
    const head = snake.head;
    const colDist = 12; // tolerance

    // Skip the first few nodes close to the head (nodes 0 to 5) to prevent false positives
    for (let i = 6; i < snake.body.length; i++) {
      const node = snake.body[i];

      if (head.z === node.z) {
        const dx = head.x - node.x;
        const dy = head.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < colDist) {
          return true;
        }
      }
    }
    return false;
  }
}
