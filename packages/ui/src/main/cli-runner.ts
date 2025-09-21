import * as electron from 'electron';
import path from 'path';
import fssync from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { getProjectDir, setProjectDir } from './ipc-project.js';

const baseDir = __dirname;

const execFileAsync = promisify(execFile);

async function runPnpm(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const corepackCmd = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  try {
    const { stdout, stderr } = await execFileAsync(pnpmCmd, args, { cwd });
    return { stdout: String(stdout ?? ''), stderr: String(stderr ?? '') };
  } catch (e: any) {
    // If pnpm is not installed or not in PATH, try via Corepack
    if (e && (e.code === 'ENOENT' || /not recognized|not found/i.test(String(e.message || '')))) {
      const { stdout, stderr } = await execFileAsync(corepackCmd, ['pnpm', ...args], { cwd });
      return { stdout: String(stdout ?? ''), stderr: String(stderr ?? '') };
    }
    throw e;
  }
}

export async function ensureCliAndDepsBuilt(): Promise<void> {
  const uiDistDir = path.resolve(baseDir, '..');
  const repoRoot = path.resolve(uiDistDir, '../../..');
  const pkgsDir = path.resolve(uiDistDir, '../..');
  const cliDist = path.join(pkgsDir, 'cli', 'dist', 'bin.js');
  const coreDist = path.join(pkgsDir, 'core', 'dist', 'index.js');
  const storageDist = path.join(pkgsDir, 'storage', 'dist', 'index.js');
  const chainDist = path.join(pkgsDir, 'chain-solana', 'dist', 'index.js');

  const needCore = !fssync.existsSync(coreDist);
  const needStorage = !fssync.existsSync(storageDist);
  const needChain = !fssync.existsSync(chainDist);
  const needCli = !fssync.existsSync(cliDist);

  try {
    if (needCore) await runPnpm(['-C', path.join(pkgsDir, 'core'), 'build'], repoRoot);
    if (needStorage) await runPnpm(['-C', path.join(pkgsDir, 'storage'), 'build'], repoRoot);
    if (needChain) await runPnpm(['-C', path.join(pkgsDir, 'chain-solana'), 'build'], repoRoot);
    if (needCli) await runPnpm(['-C', path.join(pkgsDir, 'cli'), 'build'], repoRoot);
  } catch (e) {
    console.warn('ensureCliAndDepsBuilt: build step failed:', e);
  }
  // Final check: if CLI is still missing, surface a clear guidance error
  if (!fssync.existsSync(cliDist)) {
    throw new Error(
      'CLI is not built (missing packages/cli/dist/bin.js). ' +
        'Please run "corepack enable" (once), then run "pnpm install" and "pnpm build" at the repository root.'
    );
  }
}

export function runNodeModule(binPath: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    // In Electron main, process.execPath is the Electron binary. Ensure it runs as Node.
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' } as NodeJS.ProcessEnv;
    const child = spawn(process.execPath, [binPath, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'], env });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += String(d); });
    child.stderr?.on('data', (d) => { stderr += String(d); });
    child.on('error', (err) => reject(err));
    child.on('exit', (code) => resolve({ stdout, stderr, code }));
  });
}

export function initCliRunner(): void {
  electron.ipcMain.handle('foundry:run', async (_evt, args: string[]) => {
    try {
      let projectDir = getProjectDir();
      if (!projectDir) {
        const pick = await electron.dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (pick.canceled || pick.filePaths.length === 0) return { ok: false, error: 'Select a project directory first.' };
        projectDir = pick.filePaths[0] as string;
        setProjectDir(projectDir);
      }
      await ensureCliAndDepsBuilt();
      const root = path.join(baseDir, '../../../cli');
      const bin = path.join(root, 'dist', 'bin.js');
      const { stdout, stderr, code } = await runNodeModule(bin, args, projectDir);
      if (code !== 0) {
        throw new Error(stderr || `CLI exited with code ${code}`);
      }
      return { ok: true, stdout: String(stdout ?? '') };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
}
