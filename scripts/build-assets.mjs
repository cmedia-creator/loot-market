import { mkdir, rm, copyFile } from 'node:fs/promises';

const files = [
  'index.html',
  'admin.html',
  'game.css',
  'game.js',
  'boss-skills.css',
  'boss-skills.js',
  'affiliate-ui.css',
  'affiliate-ui.js',
  'account-ui.css',
  'account-ui.js',
  'dice-system.css',
  'dice-system.js',
  'rarity-system.css',
  'rarity-system.js'
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all(files.map((file) => copyFile(file, `dist/${file}`)));
console.log(`Prepared ${files.length} static assets for Workers Static Assets.`);
