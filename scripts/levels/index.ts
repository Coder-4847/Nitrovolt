import { LevelDef } from './dsl';
import { TRAINING_DEFS } from './training';
import { CAMPAIGN_DEFS } from './campaign';
import { LAB } from './lab';

/** Every hand-made level the game ships, in play order: the campaign, then training. */
export const LEVEL_DEFS: LevelDef[] = [...CAMPAIGN_DEFS, ...TRAINING_DEFS];

/** Test layouts for tools (not shipped). */
export const DEV_DEFS: LevelDef[] = [LAB];

export const findDef = (id: string): LevelDef | undefined => [...LEVEL_DEFS, ...DEV_DEFS].find((d) => d.id === id);
