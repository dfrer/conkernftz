// P3 — the data contract between the in-app builder and the generated static mint site.
// `buildSiteData` packs everything the standalone site needs (resolved site config, mint
// experience, baked-in preview images) into one serializable object; the site template
// (src/site-template) reads it from a global at runtime and renders it with the SAME
// SiteRenderer + MintExperience — so the shipped page is identical to the builder preview.
// DOM-free + pure → unit-tested directly.

import { resolveSite, type SiteConfig } from './site';
import { resolveExperience, type ExperienceConfig } from './mintExperience';

export interface SiteData {
  version: 1;
  name: string;
  site: SiteConfig;
  experience: ExperienceConfig;
  /** Baked-in card/gallery art as data URLs (self-contained — no external asset fetches). */
  images: string[];
}

export const SITE_GLOBAL = '__CONKER_SITE__';
export const SITE_DATA_FILENAME = 'site-data.js';

export function buildSiteData(input: {
  name?: string;
  site?: Partial<SiteConfig> | null;
  experience?: Partial<ExperienceConfig> | null;
  images?: string[];
}): SiteData {
  return {
    version: 1,
    name: input.name && input.name.trim() ? input.name.trim() : 'CONKERNFTZ',
    site: resolveSite(input.site),
    experience: resolveExperience(input.experience),
    images: Array.isArray(input.images) ? input.images.filter((s) => typeof s === 'string') : [],
  };
}

/**
 * A `<script>`-safe assignment of the bundle to the global the template reads. The `<` → <
 * escape neutralizes any `</script>` inside string values so it can't break out of the tag.
 */
export function siteDataScript(data: SiteData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `window.${SITE_GLOBAL} = ${json};\n`;
}

/** Insert the site-data script tag into the built template HTML (before the app module script). */
export function injectSiteDataTag(html: string): string {
  const tag = `<script src="./${SITE_DATA_FILENAME}"></script>`;
  if (html.includes(tag)) return html;
  const moduleIdx = html.indexOf('<script type="module"');
  if (moduleIdx >= 0) return `${html.slice(0, moduleIdx)}${tag}\n    ${html.slice(moduleIdx)}`;
  return html.replace('</head>', `  ${tag}\n  </head>`);
}
