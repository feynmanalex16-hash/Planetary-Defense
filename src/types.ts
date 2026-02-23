/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Language {
  EN = 'EN',
  CN = 'CN',
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
}

export interface Missile extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  speed: number;
  progress: number; // 0 to 1
}

export interface EnemyRocket extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  speed: number;
}

export interface GravityWell {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  energy: number;
  maxEnergy: number;
}

export interface Explosion extends Entity {
  radius: number;
  maxRadius: number;
  duration: number;
  elapsed: number;
}

export interface Battery extends Entity {
  ammo: number;
  maxAmmo: number;
  isDestroyed: boolean;
}

export interface City extends Entity {
  isDestroyed: boolean;
}

export interface BackgroundElement {
  x: number;
  w: number;
  h: number;
  brokenX: number;
  brokenW: number;
}

export type GameStatus = 'START' | 'PLAYING' | 'PAUSED' | 'WON' | 'LOST';

export interface GameState {
  score: number;
  status: GameStatus;
  language: Language;
  batteries: Battery[];
  cities: City[];
  missiles: Missile[];
  enemyRockets: EnemyRocket[];
  explosions: Explosion[];
  shakeIntensity: number;
  wave: number;
  backgroundElements: BackgroundElement[];
  showTutorial: boolean;
  gravityWell: GravityWell;
}

export const GAME_WIDTH = 1000;
export const GAME_HEIGHT = 600;
export const TARGET_SCORE = 1000;
export const EXPLOSION_MAX_RADIUS = 60;
export const EXPLOSION_DURATION = 1500; // ms
export const ROCKET_SPEED_BASE = 0.8; // Decreased from 1.5
export const MISSILE_SPEED_BASE = 0.05;
export const GRAVITY_STRENGTH = 5000;
export const GRAVITY_RADIUS = 200;
