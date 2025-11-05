# ConkerNFT Executable

## 🚀 Quick Start

### Option 1: Standalone Executable (Recommended)
**Double-click `ConkerNFT.exe`** in the project root folder to launch the application.

The executable is located at:
- `ConkerNFT.exe` (convenience copy in project root)
- `packages/ui-tauri/src-tauri/target/release/foundry-ui.exe` (original build location)

### Option 2: Launcher Scripts
If you prefer to use the Electron version instead:
- **Windows Batch**: Double-click `ConkerNFT-Launcher.bat`
- **PowerShell**: Right-click `ConkerNFT-Launcher.ps1` → Run with PowerShell

### Option 3: Command Line
```bash
# Tauri executable (standalone)
.\ConkerNFT.exe

# Or Electron GUI (requires pnpm)
pnpm -C packages/ui start
```

## 📦 What's Included

- **ConkerNFT.exe**: Standalone Windows executable (Tauri build)
  - No dependencies required
  - Smaller file size
  - Native Windows performance

- **ConkerNFT-Launcher.bat**: Quick launcher for Electron version
  - Requires pnpm and Node.js
  - Faster startup for development

## 🔄 Rebuilding the Executable

If you make code changes and need to rebuild:

```bash
# 1. Build all packages
pnpm build

# 2. Build the Tauri executable
pnpm -C packages/ui-tauri build

# 3. The executable will be in:
# packages/ui-tauri/src-tauri/target/release/foundry-ui.exe
```

## 📝 Notes

- The Tauri executable is a standalone binary - you can copy it to any Windows machine and run it
- The executable includes the full application, no installation needed
- For distribution, you can share the `.exe` file directly

## 🛠️ Requirements

For building (not needed to run the executable):
- Node.js ≥ 18.18
- PNPM 9.x
- Rust toolchain (for Tauri builds)

For running the executable:
- Windows 10 or later
- No additional software required!


