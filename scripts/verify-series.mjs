#!/usr/bin/env node
// Basic verification for series aggregation and ordering
// KISS: no external deps; naive frontmatter parsing

import fs from 'node:fs';
import path from 'node:path';

const contentRoot = path.resolve('src/content');
const blogsRoot = path.join(contentRoot, 'blogs');

function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(p));
    else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) out.push(p);
  }
  return out;
}

function parseFrontmatter(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const m = txt.match(/^---\n([\s\S]*?)\n---/);
  const data = {};
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (!kv) continue;
      const key = kv[1];
      let val = kv[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key === 'seriesIndex') {
        const n = Number(val);
        if (!Number.isNaN(n)) data.seriesIndex = n;
      } else if (key === 'parent') {
        data.parent = val;
      } else if (key === 'datetime') {
        data.datetime = val;
      } else if (key === 'title') {
        data.title = val;
      }
    }
  }
  return data;
}

function cmpAsc(a, b) { return a - b; }

const files = listFiles(blogsRoot);
if (!files.length) {
  console.log('[verify-series] No blog files found under', blogsRoot);
  process.exit(0);
}

const entries = files.map(f => ({ file: f, data: parseFrontmatter(f) }))
  .filter(e => e.data && e.data.parent);

const map = new Map();
for (const e of entries) {
  const k = e.data.parent.trim();
  const list = map.get(k) ?? [];
  list.push(e);
  map.set(k, list);
}

const series = [...map.entries()].sort(([a],[b]) => a.localeCompare(b, 'zh-TW'));
console.log(`[verify-series] total series: ${series.length}`);
for (const [name, list] of series) {
  console.log(`- ${name}: ${list.length} 篇`);
  const sorted = list.slice().sort((a, b) => {
    const ai = Number.isFinite(a.data.seriesIndex) ? a.data.seriesIndex : Number.POSITIVE_INFINITY;
    const bi = Number.isFinite(b.data.seriesIndex) ? b.data.seriesIndex : Number.POSITIVE_INFINITY;
    if (ai !== bi) return ai - bi;
    const at = new Date(a.data.datetime).getTime();
    const bt = new Date(b.data.datetime).getTime();
    return at - bt; // oldest → newest
  });
  const ok = sorted.every((e, i) => e === list[i]) || sorted.every((e, i) => e.file === list[i].file);
  console.log(`  order check: ${ok ? 'OK' : 'WARN (content order might differ; UI will sort)'}`);
}

