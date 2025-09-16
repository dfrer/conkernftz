import fs from 'node:fs/promises';
import path from 'node:path';
import type { SpawnMap, SpawnDot } from './types.js';

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

export function validateSpawnMap(json: any): SpawnMap | undefined {
  if (!json || typeof json !== 'object') return undefined;
  if (json.version !== 1) return undefined;
  const a = json.authoringSize;
  if (!a || typeof a.width !== 'number' || typeof a.height !== 'number' || a.width <= 0 || a.height <= 0) return undefined;
  const dots = Array.isArray(json.dots) ? json.dots.filter(validDot) : [];
  const out: SpawnMap = {
    version: 1,
    authoringSize: { width: Math.round(a.width), height: Math.round(a.height) },
    dots,
    mappings: json.mappings && typeof json.mappings === 'object' ? { ...json.mappings } : undefined,
    rules: json.rules && typeof json.rules === 'object' ? { ...json.rules } : undefined,
  };
  return out;
}

function validDot(d: any): d is SpawnDot {
  if (!d || typeof d !== 'object') return false;
  if (typeof d.id !== 'string' || d.id.length === 0) return false;
  if (typeof d.x !== 'number' || typeof d.y !== 'number') return false;
  if (d.x < 0 || d.x > 1 || d.y < 0 || d.y > 1) return false;
  return true;
}


