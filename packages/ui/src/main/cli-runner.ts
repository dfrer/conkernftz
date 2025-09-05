import * as electron from 'electron';
import path from 'path';
import fssync from 'node:fs';
import { execFile, fork } from 'node:child_process';
import { promisify } from 'node:util';
import { getProjectDir, setProjectDir } from './ipc-project.js';

const baseDir = __dirname;

const execFileAsync = promisify(execFile);

async function runPnpm(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const { stdout, stderr } = await execFileAsync(cmd, args, { cwd });
  return { stdout: String(stdout ?? ''), stderr: String(stderr ?? '') };
}

async function ensureCliAndDepsBuilt(): Promise<void> {
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
}

function runNodeModule(binPath: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = fork(binPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
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
