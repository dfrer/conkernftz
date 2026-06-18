import { describe, it, expect } from 'vitest';
import { FAL_CATALOG, buildPayload, defaultsFor, findModel, mergeCatalog, parseModels } from '../lib/falCatalog';

describe('falCatalog', () => {
  const flux = findModel(FAL_CATALOG, 'flux/dev')!;

  it('defaultsFor returns each param default and omits defaultless params', () => {
    const d = defaultsFor(flux);
    expect(d.image_size).toBe('square_hd');
    expect(d.num_images).toBe(1);
    expect(d.num_inference_steps).toBe(28);
    expect('seed' in d).toBe(false);
  });

  it('buildPayload includes prompt + defaults, omits blank seed, coerces numbers', () => {
    const p = buildPayload(flux, { image_size: 'landscape_16_9', num_images: '3', seed: '' }, 'a cat');
    expect(p.prompt).toBe('a cat');
    expect(p.image_size).toBe('landscape_16_9');
    expect(p.num_images).toBe(3); // coerced to a number
    expect(p.num_inference_steps).toBe(28); // default filled in
    expect('seed' in p).toBe(false); // blank + no default → omitted
  });

  it('buildPayload with an unknown model still sends the prompt', () => {
    expect(buildPayload(undefined, { x: 1 }, 'hi')).toEqual({ prompt: 'hi' });
  });

  it('mergeCatalog adds new models and overrides by id', () => {
    const merged = mergeCatalog(FAL_CATALOG, [
      { id: 'flux/dev', label: 'Overridden', category: 'image', params: [] },
      { id: 'my/model', label: 'Mine', category: 'video', params: [] },
    ]);
    expect(findModel(merged, 'flux/dev')!.label).toBe('Overridden');
    expect(findModel(merged, 'my/model')!.category).toBe('video');
    expect(merged.length).toBe(FAL_CATALOG.length + 1);
  });

  it('parseModels accepts an array or {models}, skips junk, defaults category to image', () => {
    expect(parseModels('not json')).toEqual([]);
    const a = parseModels('[{"id":"a/b"},{"nope":1},{"id":"c/d","category":"video"}]');
    expect(a.map((m) => m.id)).toEqual(['a/b', 'c/d']);
    expect(a[0]!.category).toBe('image'); // default
    expect(a[0]!.label).toBe('a/b'); // label falls back to id
    expect(a[1]!.category).toBe('video');
    const wrapped = parseModels('{"models":[{"id":"x/y","label":"XY"}]}');
    expect(wrapped[0]!.label).toBe('XY');
  });
});
