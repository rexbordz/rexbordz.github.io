/* Stamps each widget's link-preview tags into its docs shim, from catalog.js.

   Crawlers (Discord, iMessage, Slack) don't run JS and Pages doesn't render
   server-side, so og: tags have to be real bytes in the file. This projects
   them there, which keeps the shim's only hand-written field the id.

   Run: node .shared/tools/stamp-meta.mjs   (the pre-commit hook does it for you) */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const START = '<!-- meta:start';
const END = '<!-- meta:end -->';

const read = (p) => readFile(path.join(ROOT, p), 'utf8');

// Both config files are plain `window.X = ...` assignments, so evaluating them
// against a stub beats keeping a second parser in sync with the catalog.
async function load(...files) {
  const g = {};
  for (const f of files) new Function('window', await read(f))(g);
  return g;
}

// Same set as CHROME.esc — two descriptions carry a literal '&'.
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function block(c, site) {
  const url = (p) => new URL(p, site.origin.replace(/\/*$/, '/')).href;
  const tag = (s) => '  ' + s;
  const lines = [
    `${START} — generated from .shared/core/catalog.js by .shared/tools/stamp-meta.mjs. Do not hand-edit. -->`,
    `<title>${esc(c.name)} — Install Guide</title>`,
    `<meta name="description" content="${esc(c.description || '')}">`,
    '<meta property="og:type" content="article">',
    `<meta property="og:site_name" content="${esc(site.brand || '')}">`,
    `<meta property="og:url" content="${esc(url(c.docsUrl))}">`,
    `<meta property="og:title" content="${esc(c.name)}">`,
    `<meta property="og:description" content="${esc(c.description || '')}">`,
  ];
  // No thumb means no banner — the embed degrades to title and description.
  if (c.thumb) lines.push(`<meta property="og:image" content="${esc(url(c.thumb))}">`);
  lines.push('<!-- Left stripe of the Discord embed. -->');
  lines.push(`<meta name="theme-color" content="${esc(c.accent || '#3b82f6')}">`);
  if (c.thumb) lines.push('<meta name="twitter:card" content="summary_large_image">');
  lines.push(END);
  return lines.map(tag).join('\n');
}

const { CATALOG = [], SITE = {} } = await load('.shared/core/catalog.js', '.shared/core/site.js');
let changed = 0, failed = 0;

for (const c of CATALOG) {
  if (!c.docsUrl) continue;
  const rel = path.posix.join(c.docsUrl, 'index.html');
  let html;
  try {
    html = await read(rel);
  } catch {
    console.error(`  ${rel}  MISSING`);
    failed++;
    continue;
  }

  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < a) {
    console.error(`  ${rel}  no ${START} … ${END} markers — copy them from another docs shim`);
    failed++;
    continue;
  }

  // Match the file's own endings — autocrlf hands us CRLF on some checkouts.
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const stamped = block(c, SITE).trimStart().replace(/\n/g, eol);
  const next = html.slice(0, a) + stamped + html.slice(b + END.length);
  if (next === html) { console.log(`  ${rel}  unchanged`); continue; }
  await writeFile(path.join(ROOT, rel), next, 'utf8');
  console.log(`  ${rel}  updated`);
  changed++;
}

console.log(`${changed} file${changed === 1 ? '' : 's'} changed.`);
process.exit(failed ? 1 : 0);
