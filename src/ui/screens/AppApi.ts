import { AudioEngine } from '../../audio/AudioEngine';
import { CarDef } from '../../data/cars';
import { InputManager } from '../../core/input/InputManager';
import { GameRenderer } from '../../render/GameRenderer';
import { TrackJson } from '../../tracks/TrackSchema';
import { QualityChoice } from '../../render/Quality';
import { ScreenManager } from './ScreenManager';

export type GhostKind = 'pb' | 'author';

/** What the screens may ask of the application (keeps them independent of the game classes). */
export interface AppApi {
  readonly screens: ScreenManager;
  readonly audio: AudioEngine;
  readonly input: InputManager;
  readonly gfx: GameRenderer;
  /** What is behind the menus right now. */
  readonly mode: 'menu' | 'race' | 'replay';
  levels(): readonly TrackJson[];
  level(id: string): TrackJson | undefined;
  car(id: string): CarDef;
  /** The car on the menu podium, and switching it. */
  menuCar(): CarDef;
  cycleMenuCar(dir: 1 | -1): void;
  /** Thumbnail data URL, built lazily (may be '' until the first idle slot). */
  thumbnail(id: string, done: (url: string) => void, stillWanted?: () => boolean): void;
  /** The level the "Continue" button should open. */
  continueLevel(): string;
  playLevel(id: string): void;
  restartRace(): void;
  resume(): void;
  toMainMenu(): void;
  openLevelSelect(): void;
  hasGhost(id: string, kind: GhostKind): Promise<boolean>;
  watchReplay(id: string, kind: GhostKind): void;
  toast(msg: string): void;
  /** Fixed graphics level, or 'auto' (re-run the benchmark). */
  setQuality(q: QualityChoice): void;
  /** Name of the level in the race (pause screen). */
  currentLevelId(): string | null;

}
