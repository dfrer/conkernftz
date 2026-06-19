// Standalone mint-site entry. Built by vite.site.config.ts into dist/site-template, then the
// generator drops a site-data.js next to it that sets window.__CONKER_SITE__. This reads that
// bundle and renders it with the SAME SiteRenderer + MintExperience the in-app builder uses —
// so the shipped page is identical to the preview. Falls back to a default site when no bundle
// is present (so the template builds and can be previewed on its own).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '../renderer-next/styles/tokens.css';
import '../renderer-next/styles/ui.css';
import '../renderer-next/styles/experience.css';
import '../renderer-next/styles/site.css';
import { SiteRenderer } from '../renderer-next/components/site/SiteRenderer';
import { resolveSite, defaultSite } from '../renderer-next/lib/site';
import { resolveExperience } from '../renderer-next/lib/mintExperience';
import { SITE_GLOBAL, type SiteData } from '../renderer-next/lib/siteBundle';

const data = (window as unknown as Record<string, SiteData | undefined>)[SITE_GLOBAL];
// With a bundle, render exactly what was built; without one (template opened on its own),
// show a sensible default page rather than an empty canvas.
const site = data?.site ? resolveSite(data.site) : defaultSite();
const experience = resolveExperience(data?.experience);
const images = data?.images ?? [];

if (data?.name) document.title = data.name;

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <StrictMode>
      <SiteRenderer site={site} images={images} experience={experience} />
    </StrictMode>,
  );
}
