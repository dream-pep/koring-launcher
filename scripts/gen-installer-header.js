// Run: node scripts/gen-installer-header.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const c = createCanvas(493, 58);
const ctx = c.getContext('2d');

const g = ctx.createLinearGradient(0, 0, 493, 0);
g.addColorStop(0, '#1a1a2e');
g.addColorStop(1, '#16213e');
ctx.fillStyle = g;
ctx.fillRect(0, 0, 493, 58);

ctx.fillStyle = '#ffffff';
ctx.font = 'bold 24px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('Koring Launcher', 246, 29);

const buf = c.toBuffer('image/png');
const out = path.resolve(__dirname, '..', 'build', 'installer-header.png');
fs.writeFileSync(out, buf);
console.log('Created:', out);
