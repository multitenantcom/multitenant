// Builds dist/ for Netlify deployment (storefront/ + public/ admin + /api/* functions)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'storefront'), OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name.endsWith('.html') && !['admin.html', 'preview.html'].includes(ent.name)) {
      let html = fs.readFileSync(full, 'utf8')
        .replace(/<script[^>]+src="https:\/\/cdn\.shopify\.com\/[^"]+"[^>]*><\/script>/gi, '')
        .replace(/<script[^>]*>\s*await import\("https:\/\/cdn\.shopify\.com\/[^"]+"\)[\s\S]*?<\/script>/gi, '');
      const injectHead = `<link rel="stylesheet" href="/mv-bridge.css">`;
      const injectBody = `<script src="/mv-bridge.js" defer></script>`;
      if (html.includes('</head>')) html = html.replace('</head>', `${injectHead}\n</head>`);
      if (html.includes('</body>')) html = html.replace('</body>', `${injectBody}\n</body>`);
      fs.writeFileSync(full, html);
    }
  }
}
walk(OUT);
console.log('Built Netlify publish directory in dist/');
