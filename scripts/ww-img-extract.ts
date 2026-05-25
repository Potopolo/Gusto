/** One-off helper: read the Drive download JSON file (base64 image) and
 *  save the decoded JPEG to data/ww-screenshots/ for further inspection. */
import { readFile, mkdir, writeFile } from 'fs/promises';

const jsonPath = process.argv[2];
const outName = process.argv[3] ?? 'screenshot.jpg';
if (!jsonPath) {
  console.error('usage: ww-img-extract.ts <json-path> <out-name>');
  process.exit(1);
}
const raw = await readFile(jsonPath, 'utf-8');
const obj = JSON.parse(raw) as { content: string; title: string };
const buf = Buffer.from(obj.content, 'base64');
await mkdir('./data/ww-screenshots', { recursive: true });
const outPath = `./data/ww-screenshots/${outName}`;
await writeFile(outPath, buf);
console.log(`wrote ${outPath} (${buf.length} bytes), title=${obj.title}`);
