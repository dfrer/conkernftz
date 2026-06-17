import fs from 'node:fs/promises';
import path from 'node:path';
import type { SpawnMap, SpawnDot, SpawnMappings, SpawnRules } from './types.js';

export async function loadSpawnMapFile(projectRoot: string, mapPath?: string): Promise<SpawnMap | undefined> {
  try {
    if (!mapPath) return undefined;
    const p = path.isAbsolute(mapPath) ? mapPath : path.join(projectRoot, mapPath);
    const raw = await fs.readFile(p, 'utf8');
    const json = JSON.parse(raw);
    return validateSpawnMap(json);
  } catch {
    return undefined;
  }
}

export function validateSpawnMap(json: unknown): SpawnMap | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const j = json as Record<string, unknown>;
  if (j.version !== 1) return undefined;
  const a = j.authoringSize as { width?: unknown; height?: unknown } | undefined;
  if (!a || typeof a.width !== 'number' || typeof a.height !== 'number' || a.width <= 0 || a.height <= 0) return undefined;
  const dots = Array.isArray(j.dots) ? (j.dots as unknown[]).filter(validDot) : [];
  const out: SpawnMap = {
    version: 1,
    authoringSize: { width: Math.round(a.width), height: Math.round(a.height) },
    dots,
    mappings: j.mappings && typeof j.mappings === 'object' ? { ...(j.mappings as SpawnMappings) } : undefined,
    rules: j.rules && typeof j.rules === 'object' ? { ...(j.rules as SpawnRules) } : undefined,
  };
  return out;
}

function validDot(d: unknown): d is SpawnDot {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) return false;
  if (typeof o.x !== 'number' || typeof o.y !== 'number') return false;
  if (o.x < 0 || o.x > 1 || o.y < 0 || o.y > 1) return false;
  return true;
}


