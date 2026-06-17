// Cross-platform start script that ensures ELECTRON_RUN_AS_NODE is unset.
const { spawn } = require('node:child_process');
const path = require('node:path');

// Resolve electron binary path from the npm package
const electronPath = require('electron');

// Clone env and unset the problematic flag
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const isWin = process.platform === 'win32';
const uiDir = path.join(__dirname, '..');

function startElectron() {
  try {
    // electronPath is the Electron executable (electron.exe on Windows), so no shell needed.
    const child = spawn(electronPath, ['.'], { cwd: uiDir, stdio: 'inherit', env, shell: false });
    child.on('error', (err) => {
      console.error('Failed to launch Electron:', err && err.message ? err.message : err);
      process.exit(1);
    });
    child.on('exit', (code) => process.exit(code || 0));
  } catch (e) {
    console.error('Failed to launch Electron:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

// The launcher (conkernftz.bat) already builds the whole workspace, so it sets this flag to
// skip the redundant per-package build here and go straight to launching.
if (process.env.CONKERNFTZ_SKIP_UI_BUILD === '1') {
  startElectron();
  return;
}

// Otherwise proactively build UI assets so dist/index.html and assets are present. On Windows
// pnpm is a .cmd shim, which Node refuses to spawn without a shell (EINVAL) since 18.20/20.12,
// so use shell:true there.
try {
  const pnpm = isWin ? 'pnpm.cmd' : 'pnpm';
  const build = spawn(pnpm, ['run', 'build'], { cwd: uiDir, stdio: 'inherit', env, shell: isWin });
  build.on('error', (err) => {
    console.warn('UI build could not start:', err && err.message ? err.message : err, '; starting anyway...');
    startElectron();
  });
  build.on('exit', (code) => {
    if (code !== 0) console.warn('UI build exited with code', code, '; attempting to start anyway...');
    startElectron();
  });
} catch (e) {
  console.warn('UI build could not start:', e && e.message ? e.message : e, '; starting anyway...');
  startElectron();
}
