import { LevelDef } from './dsl';
import { CAMPAIGN_DEFS } from './campaign';
import { LAB } from './lab';

/** Every hand-made level the game ships, in play order: five worlds of five tracks. */
export const LEVEL_DEFS: LevelDef[] = CAMPAIGN_DEFS;

/** Test layouts for tools (not shipped). */
export const DEV_DEFS: LevelDef[] = [LAB];

export const findDef = (id: string): LevelDef | undefined => [...LEVEL_DEFS, ...DEV_DEFS].find((d) => d.id === id);
