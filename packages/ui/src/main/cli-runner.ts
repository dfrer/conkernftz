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

type DeployResult = { ok: boolean; url?: string; error?: string };
type ProcOut = { stdout: string; stderr: string; code: number | null };

/** Spawn a process and capture stdout/stderr/exit code. */
function spawnCapture(cmd: string, args: string[], opts: { cwd: string; env?: NodeJS.ProcessEnv }): Promise<ProcOut> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      shell: process.platform === 'win32', // npx on Windows resolves through the shell
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += String(d)));
    child.stderr?.on('data', (d) => (stderr += String(d)));
    child.on('error', (err) => reject(err));
    child.on('exit', (code) => resolve({ stdout, stderr, code }));
  });
}

// Deploy via a token-based CLI (Vercel / Netlify). The token is passed as an env var, never on
// the command line, and stays on the user's machine.
async function deployVercel(siteDir: string, token: string): Promise<DeployResult> {
  if (!token) return { ok: false, error: 'A Vercel access token is required (Vercel → Account → Tokens).' };
  const env = { ...process.env, VERCEL_TOKEN: token } as NodeJS.ProcessEnv;
  const out = await spawnCapture('npx', ['--yes', 'vercel', 'deploy', '--prod', '--yes'], { cwd: siteDir, env });
  const m = `${out.stdout}\n${out.stderr}`.match(/https?:\/\/[^\s]+\.vercel\.app[^\s]*/g);
  const url = m && m.length ? m[m.length - 1] : undefined;
  if ((out.code ?? 0) !== 0 && !url) return { ok: false, error: out.stderr.trim() || out.stdout.trim() || `Deploy failed (code ${out.code})` };
  return { ok: true, url };
}

async function deployNetlify(siteDir: string, token: string, siteId: string): Promise<DeployResult> {
  if (!token) return { ok: false, error: 'A Netlify access token is required (Netlify → User settings → Applications → Personal access tokens).' };
  if (!siteId) return { ok: false, error: 'A Netlify site ID is required (create a site, then Site configuration → Site ID). Deploy is non-interactive, so the site must exist first.' };
  // siteId is the only user value passed to a shell-spawned CLI (shell:true is needed for npx on
  // Windows) — constrain it to a safe charset so a stray metacharacter can't be interpreted.
  if (!/^[A-Za-z0-9._-]+$/.test(siteId)) return { ok: false, error: 'Netlify site ID looks invalid (expected letters, numbers, dots and dashes).' };
  const env = { ...process.env, NETLIFY_AUTH_TOKEN: token } as NodeJS.ProcessEnv;
  const out = await spawnCapture('npx', ['--yes', 'netlify', 'deploy', '--prod', '--dir=.', '--site', siteId, '--json'], { cwd: siteDir, env });
  let url: string | undefined;
  try {
    const line = out.stdout.trim().split('\n').filter(Boolean).pop() ?? '{}';
    const j = JSON.parse(line) as { deploy_url?: string; url?: string; ssl_url?: string };
    url = j.deploy_url || j.ssl_url || j.url;
  } catch {
    /* fall back to scraping */
  }
  if (!url) {
    const m = `${out.stdout}\n${out.stderr}`.match(/https?:\/\/[^\s]+netlify\.app[^\s]*/g);
    url = m && m.length ? m[m.length - 1] : undefined;
  }
  if ((out.code ?? 0) !== 0 && !url) return { ok: false, error: out.stderr.trim() || out.stdout.trim() || `Deploy failed (code ${out.code})` };
  return { ok: true, url };
}

// Deploy to decentralized storage by reusing the project's existing storage provider (Pinata for
// IPFS / Irys for Arweave) — the SAME infra the Publish stage uses. Runs in-process; the site's
// `site-export/` dir is uploaded and we hand back a browser-resolvable gateway URL.
async function deployStorage(siteDir: string, projectDir: string, host: 'ipfs' | 'arweave'): Promise<DeployResult> {
  let cfg: { storage?: { pinata?: { jwt?: string; gateway?: string }; irys?: Record<string, unknown>; local?: Record<string, unknown> } };
  try {
    cfg = JSON.parse(fssync.readFileSync(path.join(projectDir, 'foundry.config.json'), 'utf8'));
  } catch {
    return { ok: false, error: 'Could not read foundry.config.json' };
  }
  const storage = cfg.storage ?? {};
  const providerName = host === 'arweave' ? 'irys' : 'pinata';
  if (providerName === 'pinata' && !storage.pinata?.jwt) {
    return { ok: false, error: 'IPFS deploy needs a Pinata JWT — set storage.pinata.jwt in the project config (the same storage you use in Publish).' };
  }
  const { createProvider } = await import('@conkernftz/storage');
  const provider = await createProvider({
    provider: providerName,
    projectRoot: projectDir,
    local: storage.local,
    pinata: storage.pinata,
    irys: storage.irys,
  });
  const res = await provider.uploadDirectory(siteDir);
  // Prefer a direct https URL to index.html; else build a gateway URL from the dir CID.
  let url = res.files?.['index.html'];
  if ((!url || url.startsWith('ipfs://')) && res.cid) {
    const gwRaw = storage.pinata?.gateway || 'https://gateway.pinata.cloud';
    const gw = (gwRaw.startsWith('http') ? gwRaw : `https://${gwRaw}`).replace(/\/$/, '');
    url = `${gw}/ipfs/${res.cid}/`;
  }
  if (!url) url = res.baseUri;
  return { ok: true, url };
}

// --- GitHub Pages (via the Git Data API; the token lives only in the Authorization header,
// never on a command line) ---
type GhRes = { ok: boolean; status: number; json: Record<string, unknown> | null; text: string };
async function ghApi(token: string, method: string, urlPath: string, body?: unknown): Promise<GhRes> {
  const res = await fetch(`https://api.github.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'conkernftz',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    /* non-JSON body */
  }
  return { ok: res.ok, status: res.status, json, text };
}
function walkFiles(root: string): { rel: string; abs: string }[] {
  const out: { rel: string; abs: string }[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const ent of fssync.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(abs, r);
      else if (ent.isFile()) out.push({ rel: r, abs });
    }
  };
  walk(root, '');
  return out;
}
async function deployGithubPages(siteDir: string, token: string, repoFull: string, branch: string, domain: string): Promise<DeployResult> {
  if (!token) return { ok: false, error: 'A GitHub token (repo scope) is required (Settings → Developer settings → Personal access tokens).' };
  const m = repoFull
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!m) return { ok: false, error: 'Repository must be in the form owner/repo.' };
  const owner = m[1] as string;
  const repo = m[2] as string;
  const br = branch.trim() || 'gh-pages';
  const err = (label: string, r: GhRes): DeployResult => ({ ok: false, error: `GitHub ${label}: ${r.status} ${(r.json?.message as string) ?? r.text}` });
  // Build a fresh tree of blobs (replaces the branch contents with exactly the export).
  const tree: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = [];
  const blobs: { rel: string; content: string }[] = walkFiles(siteDir).map((f) => ({ rel: f.rel, content: fssync.readFileSync(f.abs).toString('base64') }));
  if (!blobs.length) return { ok: false, error: 'No generated site to deploy.' };
  if (domain.trim()) blobs.push({ rel: 'CNAME', content: Buffer.from(`${domain.trim()}\n`).toString('base64') });
  for (const b of blobs) {
    const r = await ghApi(token, 'POST', `/repos/${owner}/${repo}/git/blobs`, { content: b.content, encoding: 'base64' });
    if (!r.ok) return err(`blob (${b.rel})`, r);
    tree.push({ path: b.rel, mode: '100644', type: 'blob', sha: r.json?.sha as string });
  }
  const treeRes = await ghApi(token, 'POST', `/repos/${owner}/${repo}/git/trees`, { tree });
  if (!treeRes.ok) return err('tree', treeRes);
  const ref = await ghApi(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${br}`);
  const parentSha = ref.ok ? ((ref.json?.object as { sha?: string })?.sha ?? null) : null;
  const commit = await ghApi(token, 'POST', `/repos/${owner}/${repo}/git/commits`, {
    message: 'Deploy mint site (ConkerNFTZ)',
    tree: treeRes.json?.sha,
    parents: parentSha ? [parentSha] : [],
  });
  if (!commit.ok) return err('commit', commit);
  const newSha = commit.json?.sha as string;
  if (parentSha) {
    const upd = await ghApi(token, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${br}`, { sha: newSha, force: true });
    if (!upd.ok) return err('ref update', upd);
  } else {
    const cre = await ghApi(token, 'POST', `/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${br}`, sha: newSha });
    if (!cre.ok) return err('ref create', cre);
  }
  // Best-effort: enable Pages on this branch (ignored if already enabled or token lacks scope).
  await ghApi(token, 'POST', `/repos/${owner}/${repo}/pages`, { source: { branch: br, path: '/' } }).catch(() => undefined);
  const url = domain.trim()
    ? `https://${domain.trim()}/`
    : repo.toLowerCase() === `${owner.toLowerCase()}.github.io`
      ? `https://${owner}.github.io/`
      : `https://${owner}.github.io/${repo}/`;
  return { ok: true, url };
}

/**
 * Deploy <project>/site-export to a static host. Vercel/Netlify go through their CLI (token in
 * env, never the command line); IPFS/Arweave reuse the project's storage provider in-process;
 * GitHub Pages pushes via the Git Data API (token in the header only). The artist owns the
 * deployment; ConkerNFTZ never stores or transmits their credentials.
 */
function deploySiteHandler(): void {
  electron.ipcMain.handle(
    'foundry:deploySite',
    async (_evt, payload: { provider?: string; token?: string; siteId?: string; repo?: string; branch?: string; domain?: string }): Promise<DeployResult> => {
      try {
        const projectDir = getProjectDir();
        if (!projectDir) return { ok: false, error: 'No project selected' };
        const siteDir = path.join(projectDir, 'site-export');
        if (!fssync.existsSync(path.join(siteDir, 'index.html'))) {
          return { ok: false, error: 'No generated site found — run “Generate site” first.' };
        }
        const host = payload?.provider || 'vercel';
        const token = (payload?.token || '').trim();
        const siteId = (payload?.siteId || '').trim();
        switch (host) {
          case 'vercel':
            return await deployVercel(siteDir, token);
          case 'netlify':
            return await deployNetlify(siteDir, token, siteId);
          case 'ipfs':
          case 'arweave':
            return await deployStorage(siteDir, projectDir, host);
          case 'github':
            return await deployGithubPages(siteDir, token, payload?.repo || '', payload?.branch || 'gh-pages', payload?.domain || '');
          default:
            return { ok: false, error: `Unsupported host: ${host}` };
        }
      } catch (e) {
        return { ok: false, error: String((e as Error)?.message ?? e) };
      }
    },
  );
}

export function initCliRunner(): void {
  deploySiteHandler();
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
