import { readFile } from 'fs/promises';
import * as XLSX from 'xlsx';

const buf = await readFile('./data/database-WW.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
console.log('Sheets:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const json = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  const filled = json.filter(
    (r) => Array.isArray(r) && r.some((c: unknown) => c !== '' && c != null)
  ).length;
  const withPoints = json.filter(
    (r) =>
      Array.isArray(r) &&
      r.length >= 3 &&
      r[2] !== '' &&
      r[2] != null &&
      r[2] !== '-' &&
      r[2] !== 'Points'
  ).length;
  console.log(`  ${name.padEnd(30)} ${filled} rows, ${withPoints} with points`);
}
