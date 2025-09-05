const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'dist-cjs');
try {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2));
  console.log('Wrote dist-cjs/package.json {"type":"commonjs"}');
} catch (e) {
  console.warn('postbuild: failed to write dist-cjs package.json:', e && e.message ? e.message : e);
}

