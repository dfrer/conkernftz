// Cross-platform start script that ensures ELECTRON_RUN_AS_NODE is unset
const { spawn } = require('node:child_process');
const path = require('node:path');

// Resolve electron binary path from the npm package
const electronPath = require('electron');

// Clone env and unset the problematic flag
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env,
  shell: false,
});

child.on('exit', (code) => process.exit(code || 0));

