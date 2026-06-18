// Curated fal.ai model catalog + pure payload helpers for the Fal explorer. DOM-free so
// the catalog logic is unit-tested directly. The screen renders a dynamic param form from
// the selected model's `params`, and buildPayload assembles the request body sent to fal.run.

export type FalParamType = 'text' | 'number' | 'select' | 'bool';

export interface FalParam {
  key: string;
  label: string;
  type: FalParamType;
  default?: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

export interface FalModel {
  id: string; // fal endpoint id, e.g. "flux/dev" → https://fal.run/fal-ai/flux/dev
  label: string;
  category: 'image' | 'video';
  description?: string;
  params: FalParam[];
}

export const IMAGE_SIZES = ['square_hd', 'square', 'landscape_4_3', 'landscape_16_9', 'portrait_4_3', 'portrait_16_9'];

const imageSize = (): FalParam => ({ key: 'image_size', label: 'Image size', type: 'select', options: IMAGE_SIZES, default: 'square_hd' });
const numImages = (): FalParam => ({ key: 'num_images', label: 'Images', type: 'number', default: 1, min: 1, max: 4 });
const steps = (d: number): FalParam => ({ key: 'num_inference_steps', label: 'Steps', type: 'number', default: d, min: 1, max: 50 });
const guidance = (d: number): FalParam => ({ key: 'guidance_scale', label: 'Guidance', type: 'number', default: d, min: 0, max: 20, step: 0.5 });
const seed = (): FalParam => ({ key: 'seed', label: 'Seed (blank = random)', type: 'number' });
const aspect = (): FalParam => ({ key: 'aspect_ratio', label: 'Aspect ratio', type: 'select', options: ['16:9', '9:16', '1:1'], default: '16:9' });
const duration = (): FalParam => ({ key: 'duration', label: 'Duration (s)', type: 'select', options: ['5', '10'], default: '5' });

export const FAL_CATALOG: FalModel[] = [
  { id: 'flux/dev', label: 'FLUX.1 [dev]', category: 'image', description: 'High-quality 12B text-to-image.', params: [imageSize(), numImages(), steps(28), guidance(3.5), seed()] },
  { id: 'flux/schnell', label: 'FLUX.1 [schnell]', category: 'image', description: 'Fast few-step FLUX.', params: [imageSize(), numImages(), steps(4), seed()] },
  { id: 'flux-pro/v1.1', label: 'FLUX1.1 [pro]', category: 'image', description: 'Pro-grade FLUX.', params: [imageSize(), numImages(), seed()] },
  { id: 'recraft-v3', label: 'Recraft V3', category: 'image', description: 'Design / vector-friendly.', params: [imageSize(), seed()] },
  { id: 'stable-diffusion-v35-large', label: 'Stable Diffusion 3.5 Large', category: 'image', description: 'SD 3.5 Large.', params: [imageSize(), numImages(), steps(28), guidance(3.5), seed()] },
  { id: 'fast-sdxl', label: 'Fast SDXL', category: 'image', description: 'Speedy SDXL.', params: [imageSize(), numImages(), steps(25), guidance(7.5), seed()] },
  { id: 'ltx-video', label: 'LTX Video (text → video)', category: 'video', description: 'Text-to-video.', params: [aspect(), seed()] },
  { id: 'kling-video/v1/standard/text-to-video', label: 'Kling 1.0 (text → video)', category: 'video', description: 'Text-to-video.', params: [duration(), aspect()] },
];

export function findModel(catalog: FalModel[], id: string): FalModel | undefined {
  return catalog.find((m) => m.id === id);
}

/** Initial param values for a model, taken from each param's default (params without a default are omitted). */
export function defaultsFor(model: FalModel | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!model) return out;
  for (const p of model.params) if (p.default !== undefined) out[p.key] = p.default;
  return out;
}

/** Assemble the request body: prompt + each param (blank → its default, or omitted if no default). */
export function buildPayload(model: FalModel | undefined, values: Record<string, unknown>, prompt: string): Record<string, unknown> {
  const out: Record<string, unknown> = { prompt };
  if (!model) return out;
  for (const p of model.params) {
    const v = values[p.key];
    if (v === undefined || v === '' || v === null) {
      if (p.default !== undefined) out[p.key] = p.default;
      continue;
    }
    out[p.key] = p.type === 'number' ? Number(v) : p.type === 'bool' ? Boolean(v) : v;
  }
  return out;
}

/** Merge custom/imported models over the base catalog, keyed by id (imported entries win). */
export function mergeCatalog(base: FalModel[], custom: FalModel[]): FalModel[] {
  const map = new Map<string, FalModel>();
  for (const m of base) map.set(m.id, m);
  for (const m of custom) if (m && typeof m.id === 'string' && m.id) map.set(m.id, m);
  return Array.from(map.values());
}

/** Parse a JSON string into FalModel[]. Tolerant: accepts a bare array or `{ models: [...] }`. */
export function parseModels(json: string): FalModel[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const arr: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { models?: unknown })?.models)
      ? ((data as { models: unknown[] }).models)
      : [];
  const out: FalModel[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id) continue;
    out.push({
      id: o.id,
      label: typeof o.label === 'string' ? o.label : o.id,
      category: o.category === 'video' ? 'video' : 'image',
      description: typeof o.description === 'string' ? o.description : undefined,
      params: Array.isArray(o.params) ? (o.params as FalParam[]) : [],
    });
  }
  return out;
}
