// Basic structures and configuration for the game state

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type PlayMode = 'SINGLE' | 'VERSUS';
export type GameState = 'MENU' | 'PLAYING' | 'REWINDING' | 'GAMEOVER' | 'VICTORY';

export interface GameEntity {
  id: string;
  x: number; // Logical X in [0, GAME_WIDTH]
  y: number; // Logical Y in [0, GAME_HEIGHT]
  z: number; // Logical Z layer (0, 1, 2, etc.)
  type: 'ESSENCE' | 'OBSTACLE' | 'PREREQUISITE' | 'PROJECTILE';
  width: number;
  height: number;
  color: number;
  speed: number;
  // Unique spawner parameters
  isCascadePrereq?: boolean;
  cascadeTimelineIndex?: number;
  hasCascaded?: boolean;
  cascadeProgress?: number; // 0 to 1
  warningActive?: boolean;
}

export interface SoundChannels {
  osc?: OscillatorNode;
  gain?: GainNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
}

// Config constants
export const CONFIG = {
  // Screen/Logical Dimensions
  GAME_WIDTH: 1000,
  GAME_HEIGHT: 400,

  // Speed and Scroll
  BASE_SCROLL_SPEED: 1.5,
  SNAKE_SPEED: 4,

  // Length constraints
  INITIAL_SNAKE_LENGTH: 3,
  VICTORY_LENGTH: 50, // Reaching this length triggers victory
  NODE_SPACING: 3, // distance between body nodes in history ticks

  // Dimensions (Z-layers)
  MAX_LAYERS: 10, // Max dynamic parallel timeline dimensions
  LAYER_UNSTABLE_DECELERATION: 0.1,

  // Gameplay Settings
  LEVEL_DURATION_SEC: 90,
  TARGET_WIN_SCORE: 10000,
};
