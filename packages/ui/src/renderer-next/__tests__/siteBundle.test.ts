import { describe, it, expect } from 'vitest';
import { buildSiteData, siteDataScript, injectSiteDataTag, SITE_GLOBAL, SITE_DATA_FILENAME } from '../lib/siteBundle';

describe('siteBundle', () => {
  it('buildSiteData resolves its parts and filters non-string images', () => {
    const d = buildSiteData({ name: '  My Drop ', images: ['a', 1 as unknown as string, 'b'] });
    expect(d.version).toBe(1);
    expect(d.name).toBe('My Drop');
    expect(d.site.layout).toBeDefined();
    expect(d.experience.kind).toBeDefined();
    expect(d.images).toEqual(['a', 'b']);
  });

  it('defaults the name when blank', () => {
    expect(buildSiteData({}).name).toBe('CONKERNFTZ');
  });

  it('embeds a non-empty tierMap (OC-3b) and omits an empty/absent one', () => {
    expect(buildSiteData({ tierMap: { 1: 'Legendary', 7: 'Rare' } }).tierMap).toEqual({ 1: 'Legendary', 7: 'Rare' });
    expect(buildSiteData({ tierMap: {} }).tierMap).toBeUndefined();
    expect(buildSiteData({}).tierMap).toBeUndefined();
  });

  it('siteDataScript assigns the global and neutralizes </script>', () => {
    const data = buildSiteData({ name: 'x' });
    (data.site.blocks as unknown[]).push({ id: 'h', kind: 'html', html: '</script><b>x</b>' });
    const js = siteDataScript(data);
    expect(js.startsWith(`window.${SITE_GLOBAL} = `)).toBe(true);
    expect(js).not.toContain('</script>');
    expect(js).toContain('\\u003c');
  });

  it('injectSiteDataTag inserts the data script before the module script', () => {
    const html = '<!doctype html><head></head><body><div id="root"></div><script type="module" src="./x.js"></script></body>';
    const out = injectSiteDataTag(html);
    expect(out).toContain(`<script src="./${SITE_DATA_FILENAME}"></script>`);
    expect(out.indexOf(SITE_DATA_FILENAME)).toBeLessThan(out.indexOf('type="module"'));
  });

  it('injectSiteDataTag is idempotent', () => {
    const html = `x<script src="./${SITE_DATA_FILENAME}"></script><script type="module"></script>`;
    expect(injectSiteDataTag(html)).toBe(html);
  });
});
