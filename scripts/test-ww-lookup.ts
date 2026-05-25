/** Quick smoke test for src/lib/server/ww/lookup.ts. */
import {
  findZeroPointsEntry,
  isZeroPoints,
  WW_ZEROPOINTS_SIZE
} from '../src/lib/server/ww/lookup';

console.log(`WW ZeroPoints catalogue: ${WW_ZEROPOINTS_SIZE} entries`);

const cases: Array<[string, boolean, string?]> = [
  // Should match
  ['Saumon', true, 'Saumon'],
  ['saumon fumé', true, 'Saumon fumé'],
  ['Pavé de saumon', true, 'Saumon'],
  ['Filet de boeuf', true, 'Filet de boeuf'],
  ['Filet de boeuf grillé', true, 'Filet de boeuf'],
  ['200g de cabillaud', true, 'Cabillaud'],
  ['Oeuf', true, 'Oeuf'],
  ['Crevettes décortiquées', true, 'Crevettes'],
  ['Thon en boîte', true, 'Thon'],
  // Should NOT match (boeuf seul ≠ ZeroPoints, c'est seulement les morceaux maigres)
  ['Boeuf haché', false],
  ['Boeuf', false],
  ['Lardons', false],
  ['Beurre', false],
  ['Crème fraîche', false],
  ['Riz', false],
  ['Pâtes', false],
  // Edge cases
  ['Saumonette', true, 'Saumonette'],
  ['Truite saumonée', true, 'Truite saumonée']
];

let pass = 0;
let fail = 0;
for (const [input, expected, expectedName] of cases) {
  const got = findZeroPointsEntry(input);
  const isMatch = got !== null;
  const ok =
    isMatch === expected &&
    (expectedName === undefined || got?.name === expectedName);
  const symbol = ok ? '✓' : '✗';
  console.log(
    `  ${symbol} ${input.padEnd(30)} → ${
      got ? `"${got.name}" (${got.points} pts)` : 'no match'
    }${expectedName ? `   (expected "${expectedName}")` : ''}`
  );
  if (ok) pass++;
  else fail++;
}

console.log(`\n${pass}/${pass + fail} passing`);
process.exit(fail > 0 ? 1 : 0);
