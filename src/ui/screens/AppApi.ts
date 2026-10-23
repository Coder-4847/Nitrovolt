import { AudioEngine } from '../../audio/AudioEngine';
import { CampaignState } from '../../data/campaign';
import { CarDef } from '../../data/cars';
import { InputManager } from '../../core/input/InputManager';
import { GameRenderer } from '../../render/GameRenderer';
import { TrackJson } from '../../tracks/TrackSchema';
import { QualityChoice } from '../../render/Quality';
import { ScreenManager } from './ScreenManager';
import { UserLevel } from '../../editor/UserLevels';

export type GhostKind = 'pb' | 'author';

/** What the screens may ask of the application (keeps them independent of the game classes). */
export interface AppApi {
  readonly screens: ScreenManager;
  readonly audio: AudioEngine;
  readonly input: InputManager;
  readonly gfx: GameRenderer;
  /** What is behind the menus right now. */
  readonly mode: 'menu' | 'race' | 'replay' | 'editor';
  /** A test drive from the editor is running. */
  readonly testDriving: boolean;
  campaign(): CampaignState;
  levels(): readonly TrackJson[];
  level(id: string): TrackJson | undefined;
  car(id: string): CarDef;
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

  // ---- editor / my tracks
  userLevels(): Promise<UserLevel[]>;
  /** Create a new track (optionally a copy of another level) and open it in the editor. */
  newUserLevel(copyOf?: TrackJson): Promise<void>;
  editUserLevel(id: string): Promise<void>;
  playUserLevel(id: string): Promise<void>;
  deleteUserLevel(id: string): Promise<void>;
  duplicateUserLevel(id: string): Promise<void>;
  /** Download the level as a .json file. */
  exportUserLevel(id: string): Promise<void>;
  /** A link that opens the track in anyone's browser. */
  shareLink(json: TrackJson): Promise<string>;
  /** Import a track from a file's text or a share code / link; returns its id in My tracks. */
  importTrack(text: string): Promise<string>;
  backToEditor(): void;
  editorAction(a: 'test' | 'validate' | 'share' | 'export' | 'exit'): void;
  thumbnailOf(json: TrackJson): string;
}
