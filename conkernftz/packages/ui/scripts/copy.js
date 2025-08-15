const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'index.html');
const dstDir = path.join(__dirname, '..', 'dist');
const dst = path.join(dstDir, 'index.html');
fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log('Copied index.html to dist');


