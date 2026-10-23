import { Rng } from '../core/Rng';

const FIRST: string[][] = [
  ['Apex', 'Grand', 'Victory', 'Podium', 'Pole', 'Velocity', 'Paddock', 'Pitlane', 'Chicane', 'Summit', 'Champion', 'Rapid', 'Slipstream', 'Turbo', 'Throttle', 'Gallery', 'Grandstand', 'Overdrive', 'Redline', 'Hairpin'],
  ['Frost', 'Glacier', 'Summit', 'Powder', 'Avalanche', 'Crystal', 'Pine', 'Snowcap', 'Ridge', 'Icefall', 'Blizzard', 'Tundra', 'Whiteout', 'North Face', 'Hoarfrost', 'Cornice', 'Spindrift', 'Moraine'],
  ['Mesa', 'Dune', 'Mirage', 'Sandstorm', 'Canyon', 'Scorch', 'Cactus', 'Sunburn', 'Dust Devil', 'Red Rock', 'Oasis', 'Sirocco', 'Badlands', 'Butte', 'Arroyo', 'Sidewinder', 'Heatwave', 'Saltpan'],
  ['Dusk', 'Ember', 'Amber', 'Twilight', 'Horizon', 'Golden', 'Solstice', 'Afterglow', 'Sunfire', 'Crimson', 'Copper', 'Evening', 'Nightfall', 'Marigold', 'Daybreak', 'Halo', 'Blaze', 'Saffron'],
];
const SECOND: string[][] = [
  ['Boulevard', 'Rush', 'Drift', 'Line', 'Run', 'Sprint', 'Alley', 'Overpass', 'Heights', 'Express', 'Square', 'Junction', 'Avenue', 'Mile', 'Skyway'],
  ['Pass', 'Descent', 'Run', 'Slalom', 'Switchback', 'Col', 'Traverse', 'Gully', 'Couloir', 'Climb', 'Crest', 'Valley', 'Chute'],
  ['Run', 'Leap', 'Gulch', 'Flats', 'Wash', 'Rally', 'Drop', 'Ridge', 'Basin', 'Trail', 'Jump', 'Bluff', 'Raceway'],
  ['Sprint', 'Run', 'Gauntlet', 'Rush', 'Line', 'Yard', 'Causeway', 'Chase', 'Drift', 'Overdrive', 'Works', 'Crossing'],
];
const LAP = ['Circuit', 'Ring', 'Loop', 'Speedway', 'Oval'];

/** Deterministic, unique level name for a season. */
export function levelName(season: number, seed: number, lap: boolean, used: Set<string>): string {
  const r = new Rng(seed ^ 0x9e3779b9);
  for (let i = 0; i < 400; i++) {
    const a = FIRST[season]![Math.floor(r.next() * FIRST[season]!.length)]!;
    const list = lap ? LAP : SECOND[season]!;
    const b = list[Math.floor(r.next() * list.length)]!;
    const name = `${a} ${b}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `${FIRST[season]![0]} ${used.size}`;
  used.add(fallback);
  return fallback;
}
