import { describe, it, expect } from 'vitest';
import { SITE_TEMPLATES } from '../lib/siteTemplates';
import { resolveSite } from '../lib/site';

describe('SITE_TEMPLATES', () => {
  it('every template builds a config that survives resolveSite unchanged in block count', () => {
    for (const t of SITE_TEMPLATES) {
      const cfg = t.build();
      expect(cfg.blocks.length).toBeGreaterThan(0);
      // resolveSite drops malformed blocks — a template must produce only valid ones.
      expect(resolveSite(cfg).blocks).toHaveLength(cfg.blocks.length);
    }
  });

  it('assigns unique block ids within and across builds (no id reuse)', () => {
    const t = SITE_TEMPLATES[0]!;
    const a = t.build();
    const b = t.build();
    const idsA = a.blocks.map((x) => x.id);
    expect(new Set(idsA).size).toBe(idsA.length); // unique within a build
    const overlap = idsA.filter((id) => b.blocks.some((x) => x.id === id));
    expect(overlap).toHaveLength(0); // fresh ids across builds
  });

  it('GeoCities template carries its period-correct blocks + starfield wallpaper', () => {
    const geo = SITE_TEMPLATES.find((t) => t.id === 'geocities')!.build();
    const kinds = geo.blocks.map((b) => b.kind);
    expect(kinds).toContain('wordArt');
    expect(kinds).toContain('marquee');
    expect(kinds).toContain('hitCounter');
    expect(geo.pageBg?.kind).toBe('tile');
    expect(geo.pageBg?.tile).toContain('svg');
  });

  it('Minimal mint stays lean (hero + mint + faq)', () => {
    const min = SITE_TEMPLATES.find((t) => t.id === 'minimal')!.build();
    expect(min.blocks.map((b) => b.kind)).toEqual(['hero', 'mint', 'faq']);
  });
});
