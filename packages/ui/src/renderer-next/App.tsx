import { useEffect, useState } from 'react';
import { ThemeProvider } from './theme/ThemeProvider';
import { ToastProvider } from './components';
import { AppShell } from './shell/AppShell';
import { ProjectsScreen, type Project } from './screens/ProjectsScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { PlaygroundScreen } from './screens/PlaygroundScreen';
import { bridge, isBridged } from './lib/bridge';

const VERSION = '4.0.0';

const PLACEHOLDERS: Record<string, { kicker: string; title: string; blurb: string }> = {
  design: {
    kicker: 'STAGE 01 // COMPOSITION',
    title: 'Design',
    blurb: 'Layers, traits & rarity, rules, effects, spawn placement, and the asset renamer migrate here in O2.',
  },
  preview: {
    kicker: 'STAGE 02 // INSPECTION',
    title: 'Preview',
    blurb: 'Live preview, the regenerating gallery, lightbox, and animation preview land in O3.',
  },
  build: {
    kicker: 'STAGE 03 // PRODUCTION',
    title: 'Build',
    blurb: 'Generate editions with progress / pause / resume / stop, plus rarity and audit reports — O3.',
  },
  publish: {
    kicker: 'STAGE 04 // DISPATCH',
    title: 'Publish',
    blurb: 'Provider-matched uploads, directory-CID, Solana Candy Machine / Umi, and EVM mint — O4.',
  },
  ai: {
    kicker: 'SYSTEM // GENERATION',
    title: 'Fal AI',
    blurb: 'The Fal AI image-generation surface (model catalog + dynamic parameters) is ported in a later phase.',
  },
  settings: {
    kicker: 'SYSTEM // CONFIG',
    title: 'Settings',
    blurb: 'Theme, accent, provider credentials, and the project file browser consolidate here.',
  },
  help: {
    kicker: 'SYSTEM // MANUAL',
    title: 'Help',
    blurb: 'Contextual help popovers and the field manual.',
  },
};

function nameFromConfig(json: unknown, fallback: string): string {
  if (json && typeof json === 'object' && 'name' in json) {
    const n = (json as { name?: unknown }).name;
    if (typeof n === 'string' && n.trim()) return n;
  }
  return fallback;
}

export function App() {
  const [active, setActive] = useState('projects');
  const [project, setProject] = useState<Project | null>(null);

  // Restore the active project from the bridge on boot (no-op in the browser / tests).
  useEffect(() => {
    const fb = bridge();
    if (!fb) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fb.getProjectDir();
        if (cancelled || !r.ok || !r.projectDir) return;
        const dir = r.projectDir;
        let name = dir;
        try {
          const c = await fb.readConfig();
          if (c.ok) name = nameFromConfig(c.json, dir);
        } catch {
          /* ignore */
        }
        if (!cancelled) setProject({ dir, name });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onOpen = (p: Project) => {
    setProject(p);
    setActive('design');
  };

  let screen;
  if (active === 'projects') screen = <ProjectsScreen onOpen={onOpen} />;
  else if (active === 'playground') screen = <PlaygroundScreen />;
  else {
    const p = PLACEHOLDERS[active] ?? PLACEHOLDERS.design!;
    screen = <PlaceholderScreen stage={active} kicker={p.kicker} title={p.title} blurb={p.blurb} />;
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <AppShell
          active={active}
          onNavigate={setActive}
          project={project?.name ?? null}
          bridged={isBridged()}
          version={VERSION}
        >
          {screen}
        </AppShell>
      </ToastProvider>
    </ThemeProvider>
  );
}
