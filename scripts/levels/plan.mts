// Prints a level's chain as a table of anchor cells and headings, to plan routes without overlaps.
// Usage: npx tsx scripts/levels/plan.mts <id>
import { layoutChain } from '../../src/tracks/ChainLayout';
import { findDef } from './index';

const def = findDef(process.argv[2]!)!;
const { blocks } = layoutChain(def.items, def.start);
const H = ['N', 'W', 'S', 'E'];
let line = '';
blocks.forEach((b, i) => {
  const item = def.items[i]!;
  const tag = `${i}:${item.type}${item.surface ? '/' + item.surface : ''}@(${b.gridPos[0]},${b.gridPos[1]},${b.gridPos[2]})${H[b.rot]}`;
  line += tag + '  ';
  if (i % 4 === 3) { console.log(line); line = ''; }
});
console.log(line);
