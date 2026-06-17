import * as electron from 'electron';
import path from 'node:path';
import fssync from 'node:fs';
import { spawn } from 'node:child_process';
import { getProjectDir, setProjectDir } from './ipc-project.js';

const baseDir = __dirname;

/**
 * Ensure the built CLI exists before shelling to it. We intentionally do NOT run
 * `pnpm build` at runtime anymore — that made a packaged executable impossible and
 * masked build problems. In dev the workspace build produces packages/cli/dist/bin.js;
 * if it is missing we surface a clear, actionable error.
 */
export async function ensureCliAndDepsBuilt(): Promise<void> {
  const uiDistDir = path.resolve(baseDir, '..');
  const pkgsDir = path.resolve(uiDistDir, '../..');
  const cliDist = path.join(pkgsDir, 'cli', 'dist', 'bin.js');
  if (fssync.existsSync(cliDist)) return;
  throw new Error(
    'CLI is not built (missing packages/cli/dist/bin.js). ' +
      'Run "pnpm install" and "pnpm build" at the repository root, then reopen the app.',
  );
}

export function runNodeModule(
  binPath: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    // In Electron main, process.execPath is the Electron binary. Ensure it runs as Node.
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' } as NodeJS.ProcessEnv;
    const child = spawn(process.execPath, [binPath, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'], env });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr?.on('data', (d) => {
      stderr += String(d);
    });
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
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });
}
