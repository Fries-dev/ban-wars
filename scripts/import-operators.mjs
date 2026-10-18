// Usage (from the project root):
//   node scripts/import-operators.mjs "C:\path\to\your\operator-icons"
//
// - Copies every image in that folder into packages/overlay/src/renderer/public/operators/
// - Replaces the named-operator bans in data/catalog.json with one "Ban <Name>" entry per image
//   (the 3 role bans like "No Shield Operators" are kept)
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error('Usage: node scripts/import-operators.mjs "C:\\path\\to\\operator-icons"');
  process.exit(1);
}
const exts = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg']);
const dest = path.resolve('packages/overlay/src/renderer/public/operators');
const catPath = path.resolve('data/catalog.json');
fs.mkdirSync(dest, { recursive: true });

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pretty = (base) =>
  base.replace(/[_-]+/g, ' ').replace(/\b(icon|badge|portrait|logo|op|operator)\b/gi, '').trim()
    .replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const keep = new Set(['op-no-shields', 'op-no-hardbreach', 'op-no-trap']);
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
cat.bans = cat.bans.filter((b) => b.category !== 'operator' || keep.has(b.id));

const files = fs.readdirSync(src).filter((f) => exts.has(path.extname(f).toLowerCase()));
const seen = new Set();
const added = [];
for (const f of files.sort()) {
  const ext = path.extname(f).toLowerCase();
  const base = path.basename(f, path.extname(f));
  const s = slug(pretty(base)) || slug(base);
  if (!s || seen.has(s)) { console.warn('Skipped (duplicate or empty name):', f); continue; }
  seen.add(s);
  fs.copyFileSync(path.join(src, f), path.join(dest, s + ext));
  added.push({ id: `op-${s}`, category: 'operator', label: `Ban ${pretty(base) || base}`, img: s + ext });
}
cat.bans.push(...added);
cat.version = (cat.version ?? 1) + 1;
fs.writeFileSync(catPath, JSON.stringify(cat, null, 1));

console.log(`Imported ${added.length} operators:`);
console.log(added.map((a) => a.label.replace('Ban ', '')).join(', '));
console.log('\nCheck the names above. Fix any typos (accents, spacing) directly in data/catalog.json.');
console.log('Then restart the server and the app.');
