#!/usr/bin/env node
/*
  Scrapes fal.ai Explore model pages to extract the API endpoint/link
  from each model's API tab, and writes a JSON catalog to disk.

  Usage:
    pnpm scrape:fal
    node scripts/scrape-fal-models.cjs --out fal-catalog-scraped.json --headful

  Notes:
  - This is a best-effort scraper for local use. The fal.ai UI may change.
  - Headless browsers sometimes get blocked; use --headful if needed.
  - The script looks for endpoints containing "fal.run/fal-ai/" or "api.fal.ai".
*/

const fs = require('fs');
const path = require('path');
const { setTimeout: sleep } = require('timers/promises');
const puppeteer = require('puppeteer');

const ARG = (flag, def = undefined) => {
  const i = process.argv.indexOf(flag);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  if (!v || v.startsWith('--')) return true; // boolean flag
  return v;
};

const OUT = String(ARG('--out', 'fal-catalog-scraped.json'));
const AS_CATALOG = !!ARG('--as-catalog', false);
const HEADFUL = !!ARG('--headful', false);
const VERBOSE = !!ARG('--verbose', false);
const TIMEOUT_MS = Number(ARG('--timeout', '20000')) || 20000;

// Candidate explore pages. The script will try them in order until it finds models.
const EXPLORE_URLS = [
  'https://fal.ai/explore',
  'https://fal.ai/models',
  'https://fal.ai/explore/models',
  'https://fal.ai/',
];
const SEED = ARG('--seed');
if (SEED) EXPLORE_URLS.unshift(String(SEED));

async function gotoWithRetry(page, url) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: TIMEOUT_MS });
      return true;
    } catch (e) {
      if (i === 2) throw e;
      await sleep(500 + i * 500);
    }
  }
}

async function autoScroll(page, steps = 10, stepPx = 800, stepDelay = 250) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => window.scrollBy(0, y), stepPx);
    await sleep(stepDelay);
  }
}

function extractAllEndpoints(text) {
  if (!text) return [];
  const set = new Set();
  const reList = [
    /https?:\/\/fal\.run\/fal-ai\/[\w./\-]+/ig,
    /https?:\/\/fal\.run\/[\w./\-]+/ig,
    /https?:\/\/api\.fal\.ai\/[\w./\-]+/ig,
  ];
  for (const re of reList) {
    let m;
    while ((m = re.exec(text))) set.add(m[0]);
  }
  return Array.from(set);
}
function extractEndpointFromText(text) {
  const all = extractAllEndpoints(text);
  return all[0] || null;
}

async function collectModelLinks(page) {
  // Heuristics: anchors that look like model detail pages
  const anchors = await page.$$eval('a[href]', (as) => as.map((a) => ({ href: a.href, text: (a.textContent || '').trim() })));
  const modelLinks = anchors
    .filter((a) => /\/(model|models|apps)\//i.test(a.href))
    .filter((a) => !/(login|signup)/i.test(a.href))
    .map((a) => a.href.replace(/#.*$/, ''));
  // Unique
  return Array.from(new Set(modelLinks));
}

async function clickApiTabIfPresent(page) {
  // Try obvious role/tab selectors first
  const tabCandidates = [
    'button[role="tab"]',
    '[data-testid*="tab"]',
    'button',
    'a',
  ];
  for (const sel of tabCandidates) {
    const handles = await page.$$(sel);
    for (const h of handles) {
      try {
        const label = (await page.evaluate((el) => (el.innerText || el.textContent || '').trim(), h)) || '';
        if (/^api\b/i.test(label) || /api reference/i.test(label) || /^api docs?$/i.test(label)) {
          await h.click();
          await sleep(600);
          return true;
        }
      } catch {}
    }
  }
  return false;
}

async function clickCodeLangToggles(page) {
  const labels = ['curl', 'javascript', 'typescript', 'python', 'node'];
  const candidates = await page.$$('button, [role="tab"], a');
  for (const want of labels) {
    for (const el of candidates) {
      try {
        const txt = (await page.evaluate((e) => (e.innerText || e.textContent || '').trim().toLowerCase(), el)) || '';
        if (txt === want || txt.includes(want)) {
          await el.click();
          await sleep(150);
        }
      } catch {}
    }
  }
}

function extractModelIds(text) {
  if (!text) return [];
  const ids = new Set();
  for (const m of text.matchAll(/['"](fal-ai\/[A-Za-z0-9_\-/.]+)['"]/g)) ids.add(m[1]);
  for (const m of text.matchAll(/fal\.(?:subscribe|queue\.(?:submit|status|result))\s*\(\s*['"]([^'"\s)]+)['"]/g)) {
    if (/^fal-ai\//i.test(m[1])) ids.add(m[1]);
  }
  return Array.from(ids);
}

async function scrapeModel(page, url) {
  await gotoWithRetry(page, url);
  await page.bringToFront();
  // Wait a little for client JS to hydrate
  await sleep(600);

  let name = '';
  try {
    name = await page.$eval('h1, h2', (el) => (el.innerText || el.textContent || '').trim());
  } catch {}
  if (!name) name = url.split('/').filter(Boolean).pop();

  // Click API tab if present
  await clickApiTabIfPresent(page);
  await sleep(600);
  await autoScroll(page, 4, 800, 150);
  try { await clickCodeLangToggles(page); } catch {}
  try { await page.waitForFunction(() => /fal\.run|api\.fal\.ai/i.test(document.body.innerText), { timeout: 2000 }); } catch {}

  // Grab any code blocks or text content that includes endpoints
  let endpoint = null;
  let allEndpoints = [];
  let modelId = null;
  let inputExample = null;
  let inferredInputs = [];
  let supportsQueue = false;
  try {
    const codeText = await page.$$eval('code, pre, [class*="code"], [class*="Code"]', (els) => els.map((e) => e.innerText || e.textContent || '').join('\n\n'));
    allEndpoints = extractAllEndpoints(codeText);
    endpoint = allEndpoints[0] || null;
    const ids = extractModelIds(codeText);
    if (ids.length && !modelId) modelId = ids[0];
    if (!supportsQueue) supportsQueue = /fal\.queue\./i.test(codeText);
    // Try to infer JSON example from code blocks
    const candidates = (codeText.match(/\{[\s\S]*?\}/g) || []).filter(s => s.length <= 4000);
    for (const cand of candidates) {
      try {
        const obj = JSON.parse(cand);
        const src = obj && obj.input ? obj.input : obj;
        if (src && typeof src === 'object') { inputExample = src; break; }
      } catch {}
    }
  } catch {}
  if (!endpoint) {
    try {
      const bodyText = await page.evaluate(() => document.body.innerText);
      allEndpoints = extractAllEndpoints(bodyText);
      endpoint = allEndpoints[0] || null;
      const ids = extractModelIds(bodyText);
      if (ids.length && !modelId) modelId = ids[0];
      if (!supportsQueue) supportsQueue = /fal\.queue\./i.test(bodyText);
      if (!inputExample) {
        const candidates = (bodyText.match(/\{[\s\S]*?\}/g) || []).filter(s => s.length <= 4000);
        for (const cand of candidates) { try { const obj = JSON.parse(cand); const src = obj && obj.input ? obj.input : obj; if (src && typeof src === 'object') { inputExample = src; break; } } catch {} }
      }
    } catch {}
  }
  if (!endpoint) {
    try {
      const scriptsJson = await page.$$eval('script[type="application/json"]', (els) => els.map((e) => e.textContent || '').join('\n'));
      const found = extractAllEndpoints(scriptsJson);
      allEndpoints = found.length ? found : allEndpoints;
      endpoint = found[0] || endpoint;
      const ids = extractModelIds(scriptsJson);
      if (ids.length && !modelId) modelId = ids[0];
    } catch {}
  }
  if (!endpoint) {
    try {
      // Try anchors and data-clipboard attributes
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
      const dataClip = await page.$$eval('[data-clipboard-text]', (els) => els.map((e) => e.getAttribute('data-clipboard-text')));
      const combined = hrefs.concat(dataClip.filter(Boolean));
      const found = extractAllEndpoints(combined.join('\n'));
      allEndpoints = found.length ? found : allEndpoints;
      endpoint = found[0] || endpoint;
      const ids = extractModelIds(combined.join('\n'));
      if (ids.length && !modelId) modelId = ids[0];
    } catch {}
  }
  if (VERBOSE && !endpoint) {
    console.warn('No endpoint found on page:', url);
  }

  // Find any JSON schema link(s) in the API tab
  let jsonLinks = [];
  try {
    jsonLinks = await page.$$eval('a[href]', (as) => as.map((a) => a.href).filter((h) => /json/i.test(h)));
    jsonLinks = Array.from(new Set(jsonLinks));
  } catch {}

  if (!endpoint) {
    try {
      // Try capturing any copy-to-clipboard content on the API tab
      await page.evaluate(() => {
        try {
          window._fal_copied = [];
          if (navigator && navigator.clipboard) {
            const orig = navigator.clipboard.writeText?.bind(navigator.clipboard);
            navigator.clipboard.writeText = async (t) => {
              try { window._fal_copied.push(String(t||'')); } catch {}
              return Promise.resolve();
            };
            window._fal_clip_orig = orig; // may be undefined
          }
        } catch {}
      });
      const copyButtons = await page.$$('button, [role="button"], a');
      for (const btn of copyButtons) {
        const label = (await page.evaluate((el) => (el.innerText || el.textContent || '').trim().toLowerCase(), btn)) || '';
        const aria = (await page.evaluate((el) => (el.getAttribute('aria-label') || '').toLowerCase(), btn)) || '';
        if (/copy/.test(label) || /copy/.test(aria)) {
          try { await btn.click(); await sleep(120); } catch {}
        }
      }
      const copied = await page.evaluate(() => (Array.isArray(window._fal_copied) ? window._fal_copied.join('\n') : ''));
      const found = extractAllEndpoints(copied);
      if (found.length) { endpoint = found[0]; }
    } catch {}
  }

  let id = '';
  if (endpoint) {
    id = endpoint.replace(/^https?:\/\/[^/]+\//, '');
  } else if (modelId) {
    id = modelId;
    endpoint = 'https://fal.run/' + id;
  }
  // Infer inputs from example
  if (inputExample && typeof inputExample === 'object') {
    const entries = Object.entries(inputExample);
    inferredInputs = entries.map(([key, val]) => {
      let type = 'string';
      if (typeof val === 'number') type = 'number';
      else if (typeof val === 'boolean') type = 'boolean';
      else if (Array.isArray(val)) type = 'json';
      else if (val && typeof val === 'object') type = 'json';
      if (/image_url$/i.test(key)) type = 'image';
      if (/image_urls$/i.test(key)) type = 'json';
      if (/mask/i.test(key)) type = 'mask';
      if (/audio/i.test(key)) type = 'audio';
      if (/video/i.test(key)) type = 'video';
      if (/prompt/i.test(key) && typeof val === 'string') type = 'text';
      return { key, type, label: key.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase()), group: 'basic' };
    });
  }
  return { name, pageUrl: url, endpoint: endpoint || null, id: id || null, jsonLinks, inputExample, inputs: inferredInputs, supportsQueue };
}

async function main() {
  const browser = await puppeteer.launch({ headless: HEADFUL ? false : true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36');

  let exploreUrl = null;
  for (const u of EXPLORE_URLS) {
    try {
      await gotoWithRetry(page, u);
      await autoScroll(page, 6, 900, 200);
      const links = await collectModelLinks(page);
      if (links.length >= 5) { exploreUrl = u; break; }
    } catch {}
  }
  if (!exploreUrl) {
    console.error('Could not find Explore Models page. You can pass a URL via --seed <url> by editing the script.');
  } else {
    console.log('Using explore page:', exploreUrl);
  }

  // Gather links; even if the explore page detection failed, attempt with whatever was found
  let modelLinks = [];
  try {
    await autoScroll(page, 10, 1000, 200);
    modelLinks = await collectModelLinks(page);
  } catch {}
  modelLinks = Array.from(new Set(modelLinks));
  console.log('Found model pages:', modelLinks.length);

  // Limit if asked
  const limit = Number(ARG('--limit', '0')) || 0;
  if (limit > 0) modelLinks = modelLinks.slice(0, limit);

  const out = [];
  for (let i = 0; i < modelLinks.length; i++) {
    const url = modelLinks[i];
    try {
      const tab = await browser.newPage();
      await tab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36');
      const row = await scrapeModel(tab, url);
      await tab.close();
      console.log(`[${i+1}/${modelLinks.length}]`, row.name, '=>', row.endpoint || '(not found)');
      out.push(row);
      // brief pause to be polite
      await sleep(250);
    } catch (e) {
      console.warn('Failed model page:', url, e?.message || e);
    }
  }

  const outputPath = path.resolve(process.cwd(), OUT);
  if (!AS_CATALOG) {
    fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
    console.log('Wrote', out.length, 'entries to', outputPath);
  } else {
    // Convert to a minimal catalog shape the UI can import
    const guessCategory = (id='') => {
      const s = String(id).toLowerCase();
      if (/video|motion|animate|film|gif/.test(s)) return 'video';
      if (/audio|music|voice|speech|sound/.test(s)) return 'audio';
      if (/chat|llm|gpt|embed|text/.test(s)) return 'llm';
      return 'image';
    };
    const models = out.map((m) => ({
      id: m.id || (m.endpoint ? m.endpoint.replace(/^https?:\/\/[^/]+\/fal-ai\//, '') : (m.pageUrl || 'unknown')),
      name: m.name || (m.id || 'Unknown Model'),
      category: guessCategory(m.id || m.name || ''),
      docs: m.pageUrl,
      description: m.endpoint ? `Endpoint: ${m.endpoint}` : 'Scraped from fal.ai',
      implemented: false,
      outputs: 'images',
      tags: [],
      inputs: (Array.isArray(m.inputs) && m.inputs.length ? m.inputs : []),
      inputExample: m.inputExample || null,
      supportsQueue: !!m.supportsQueue
    }));
    fs.writeFileSync(outputPath, JSON.stringify(models, null, 2));
    console.log('Wrote catalog with', models.length, 'models to', outputPath);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
