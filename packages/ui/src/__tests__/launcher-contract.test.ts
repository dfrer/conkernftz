import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..', '..');
const launcherPath = path.join(repositoryRoot, 'Launch ConkerNFTZ.bat');
const legacyLauncherPath = path.join(repositoryRoot, 'conkernftz.bat');
const shortcutPath = path.join(repositoryRoot, 'make-desktop-shortcut.bat');
const directStartPath = path.join(repositoryRoot, 'packages', 'ui', 'scripts', 'start.cjs');
const turboConfigPath = path.join(repositoryRoot, 'turbo.json');

function readRepositoryFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n');
}

describe('Windows launcher contract', () => {
  it('preserves CommonJS build artifacts required by Electron', () => {
    const turboConfig = JSON.parse(readRepositoryFile(turboConfigPath)) as {
      tasks: { build: { outputs: string[] } };
    };

    expect(turboConfig.tasks.build.outputs).toContain('dist-cjs/**');
  });

  it('builds the workspace dependency graph before a direct UI start', () => {
    const directStart = readRepositoryFile(directStartPath);

    expect(directStart).toContain("const repositoryRoot = path.join(uiDir, '..', '..');");
    expect(directStart).toContain("spawn(pnpm, ['-w', 'build']");
    expect(directStart).toContain('cwd: repositoryRoot');
  });

  it('keeps a quoted, location-independent primary launcher and a legacy forwarding entry point', () => {
    const launcher = readRepositoryFile(launcherPath);
    const legacyLauncher = readRepositoryFile(legacyLauncherPath);

    expect(launcher).toContain('set "SCRIPT_DIR=%~dp0"');
    expect(launcher).toContain('cd /d "%SCRIPT_DIR%"');
    expect(launcher).toContain('if /I "%~1"=="--check" goto :check');
    expect(launcher).toContain('call :findPnpm9');
    expect(launcher).toContain('if "%PNPM_MAJOR%"=="9" exit /b 0');
    expect(launcher).toContain('call corepack pnpm@9.1.0 --version >nul 2>nul');
    expect(launcher).toContain('set "PACKAGE_RUNNER=corepack"');
    expect(launcher).toContain('set "PACKAGE_RUNNER=pnpm"');
    expect(launcher).toContain('call :runPackageManager install');
    expect(launcher).toContain('call :runPackageManager -w build');
    expect(launcher).toContain('call :runPackageManager -C packages/ui start');
    expect(launcher).toContain('call corepack pnpm@9.1.0 %*');
    expect(launcher).toContain('call pnpm %*');
    expect(launcher).toMatch(
      /:runCorepackPnpm\s+call corepack pnpm@9\.1\.0 %\*\s+exit \/b %ERRORLEVEL%/,
    );
    expect(launcher).toMatch(/:runPathPnpm\s+call pnpm %\*\s+exit \/b %ERRORLEVEL%/);
    expect(launcher).toContain('ERROR: No verified package runner is available.');
    expect(launcher).toContain('ERROR: Corepack could not prepare pinned pnpm 9.1.0');
    expect(launcher).not.toContain('corepack enable');
    expect(launcher.indexOf('if /I "%~1"=="--check" goto :check')).toBeLessThan(
      launcher.indexOf('call :runPackageManager install'),
    );
    const checkSection = launcher.slice(
      launcher.indexOf('\n:check\n'),
      launcher.indexOf('\n:ensurePnpm\n'),
    );
    expect(checkSection).toContain('where corepack >nul 2>nul');
    expect(checkSection).not.toContain('corepack pnpm@9.1.0');
    expect(checkSection).not.toContain('pnpm --version');
    expect(legacyLauncher).toMatch(/call\s+"%~dp0Launch ConkerNFTZ\.bat"\s+%\*/i);
  });

  it('creates desktop shortcuts for the primary launcher and uses Electron only when available', () => {
    const shortcut = readRepositoryFile(shortcutPath);

    expect(shortcut).toContain("Join-Path $root 'Launch ConkerNFTZ.bat'");
    expect(shortcut).toContain("'ConkerNFTZ.lnk'");
    expect(shortcut).toContain('$lnk.WorkingDirectory = $root');
    expect(shortcut).toContain("'node_modules\\electron\\dist\\electron.exe'");
    expect(shortcut).toContain("if ($electron) { $lnk.IconLocation = $electron + ',0' }");
    expect(shortcut).toContain('powershell -NoProfile -Command');
    expect(shortcut).not.toContain('-ExecutionPolicy Bypass');
  });

  it.skipIf(process.platform !== 'win32')(
    'runs --check from another working directory without starting the app',
    () => {
      const commandInterpreter = process.env.ComSpec ?? 'cmd.exe';
      const callerDirectory = process.env.SystemRoot ?? 'C:\\Windows';
      const result = spawnSync(
        commandInterpreter,
        ['/d', '/s', '/c', `call "${launcherPath}" --check && cd`],
        {
          cwd: callerDirectory,
          encoding: 'utf8',
          timeout: 30_000,
          windowsVerbatimArguments: true,
        },
      );

      const output = `${result.stdout}${result.stderr}`;
      expect(result.error).toBeUndefined();
      expect(result.status, output).toBe(0);
      expect(output).toContain('Check passed:');
      expect(output).not.toContain('Building');
      expect(output).not.toContain('Launching ConkerNFTZ Studio');
      expect(output.toLowerCase()).toContain(callerDirectory.toLowerCase());
    },
  );

  it.skipIf(process.platform !== 'win32')(
    'propagates a selected package runner failure without building or opening Electron',
    () => {
      const fixtureDirectory = fs.mkdtempSync(
        path.join(process.env.TEMP ?? 'C:\\Windows\\Temp', 'conkernftz-launcher-'),
      );
      const commandInterpreter = process.env.ComSpec ?? 'cmd.exe';

      try {
        fs.writeFileSync(path.join(fixtureDirectory, 'node.cmd'), '@echo off\r\nexit /b 0\r\n');
        fs.writeFileSync(
          path.join(fixtureDirectory, 'pnpm.cmd'),
          '@echo off\r\nif "%~1"=="--version" echo 9.1.0\r\nif "%~1"=="--version" exit /b 0\r\necho FAKE_PNPM_RUNNER_FAILURE\r\nexit /b 17\r\n',
        );

        const result = spawnSync(commandInterpreter, ['/d', '/s', '/c', `call "${launcherPath}"`], {
          cwd: process.env.SystemRoot ?? 'C:\\Windows',
          encoding: 'utf8',
          env: {
            ...process.env,
            CONKERNFTZ_NO_PAUSE: '1',
            PATH: `${fixtureDirectory};${process.env.SystemRoot ?? 'C:\\Windows'}\\System32`,
          },
          timeout: 30_000,
          windowsVerbatimArguments: true,
        });

        const output = `${result.stdout}${result.stderr}`;
        expect(result.error).toBeUndefined();
        expect(result.status, output).toBe(1);
        expect(output).toContain('FAKE_PNPM_RUNNER_FAILURE');
        expect(output).toContain('ERROR: The build failed.');
        expect(output).not.toContain('Launching ConkerNFTZ Studio');
      } finally {
        fs.rmSync(fixtureDirectory, { recursive: true, force: true });
      }
    },
  );
});
