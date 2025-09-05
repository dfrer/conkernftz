const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'index.html');
const dstDir = path.join(__dirname, '..', 'dist');
const dst = path.join(dstDir, 'index.html');
fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log('Copied index.html to dist');

// Ensure CommonJS preload file is available in dist
const preloadCjsSrc = path.join(__dirname, '..', 'src', 'preload.cjs');
const preloadCjsDst = path.join(dstDir, 'preload.cjs');
try {
  if (fs.existsSync(preloadCjsSrc)) {
    fs.copyFileSync(preloadCjsSrc, preloadCjsDst);
    console.log('Copied preload.cjs to dist');
  }
} catch (e) {
  console.warn('Failed to copy preload.cjs:', e && e.message ? e.message : e);
}

// No CJS entry bootstrap needed when main is compiled to CommonJS

// Copy assets directory if present so images are available at runtime
const assetsSrcDir = path.join(__dirname, '..', 'src', 'assets');
const assetsDstDir = path.join(dstDir, 'assets');
const cssFiles = [
  path.join(__dirname, '..', 'src', 'styles.css'),
  path.join(__dirname, '..', 'src', 'design-system', 'tokens.css'),
];

function copyDirRecursive(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

copyDirRecursive(assetsSrcDir, assetsDstDir);
if (fs.existsSync(assetsSrcDir)) console.log('Copied assets to dist');

for (const css of cssFiles) {
  if (fs.existsSync(css)) {
    const rel = path.relative(path.join(__dirname, '..', 'src'), css);
    const target = path.join(dstDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(css, target);
    console.log(`Copied ${rel} to dist`);
  }
}

// Also pull root-level logos and help icon into dist/assets if available
const repoRoot = path.join(__dirname, '..', '..', '..', '..');
const root512 = path.join(repoRoot, '512x512.png');
const root1024 = path.join(repoRoot, '1024x1024.png');
const rootHelpIconJpg = path.join(repoRoot, 'helpicon.jpg');
const rootHelpIconPng = path.join(repoRoot, 'helpicon.png');
const dstLogo512 = path.join(assetsDstDir, 'logo-512.png');
const dstLogo1024 = path.join(assetsDstDir, 'logo-1024.png');
const dstHelpIconJpg = path.join(assetsDstDir, 'helpicon.jpg');
const dstHelpIconPng = path.join(assetsDstDir, 'helpicon.png');
try {
  // Only copy root-level logos if not already provided by UI assets
  if (fs.existsSync(root512)) {
    fs.mkdirSync(assetsDstDir, { recursive: true });
    if (!fs.existsSync(dstLogo512)) {
      fs.copyFileSync(root512, dstLogo512);
      console.log('Copied 512x512.png -> dist/assets/logo-512.png');
    } else {
      console.log('Skipped root 512x512.png (dist/assets/logo-512.png already exists)');
    }
  }
  if (fs.existsSync(root1024)) {
    fs.mkdirSync(assetsDstDir, { recursive: true });
    if (!fs.existsSync(dstLogo1024)) {
      fs.copyFileSync(root1024, dstLogo1024);
      console.log('Copied 1024x1024.png -> dist/assets/logo-1024.png');
    } else {
      console.log('Skipped root 1024x1024.png (dist/assets/logo-1024.png already exists)');
    }
  }
  if (fs.existsSync(rootHelpIconPng)) {
    fs.mkdirSync(assetsDstDir, { recursive: true });
    fs.copyFileSync(rootHelpIconPng, dstHelpIconPng);
    console.log('Copied helpicon.png -> dist/assets/helpicon.png');
  }
  if (fs.existsSync(rootHelpIconJpg)) {
    fs.mkdirSync(assetsDstDir, { recursive: true });
    fs.copyFileSync(rootHelpIconJpg, dstHelpIconJpg);
    console.log('Copied helpicon.jpg -> dist/assets/helpicon.jpg');
  }
} catch (e) {
  console.warn('Failed to copy root logos:', e && e.message ? e.message : e);
}
