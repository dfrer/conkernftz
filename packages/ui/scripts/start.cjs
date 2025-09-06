// Cross-platform start script that ensures ELECTRON_RUN_AS_NODE is unset
const { spawn } = require('node:child_process');
const path = require('node:path');

// Resolve electron binary path from the npm package
const electronPath = require('electron');

// Clone env and unset the problematic flag
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// Proactively build UI assets so dist/index.html and assets are present
try {
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const build = spawn(pnpm, ['run', 'build'], { cwd: path.join(__dirname, '..'), stdio: 'inherit', env, shell: false });
  build.on('exit', (code) => {
    if (code !== 0) console.warn('UI build exited with code', code, '; attempting to start anyway...');
    startElectron();
  });
} catch (e) {
  console.warn('Failed to run UI build before start:', e && e.message ? e.message : e);
  startElectron();
}

function startElectron() {
  const child = spawn(electronPath, ['.'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env,
  shell: false,
  });
  child.on('exit', (code) => process.exit(code || 0));
}
