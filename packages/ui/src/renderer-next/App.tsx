import { useState } from 'react';
import { ThemeProvider } from './theme/ThemeProvider';
import { ToastProvider } from './components';
import { ProjectProvider, useProject } from './state/project';
import { AppShell } from './shell/AppShell';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { DesignScreen } from './screens/DesignScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { PlaygroundScreen } from './screens/PlaygroundScreen';
import { isBridged } from './lib/bridge';

const VERSION = '4.0.0';

const PLACEHOLDERS: Record<string, { kicker: string; title: string; blurb: string }> = {
  build: {
    kicker: 'STAGE 03 // PRODUCTION',
    title: 'Build',
    blurb: 'Generate editions with progress / pause / resume / stop, plus rarity and audit reports — next up.',
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

function Shell() {
  const [active, setActive] = useState('projects');
  const { project } = useProject();

  let screen;
  if (active === 'projects') screen = <ProjectsScreen onOpened={() => setActive('design')} />;
  else if (active === 'design') screen = <DesignScreen />;
  else if (active === 'preview') screen = <PreviewScreen />;
  else if (active === 'playground') screen = <PlaygroundScreen />;
  else {
    const p = PLACEHOLDERS[active] ?? PLACEHOLDERS.build!;
    screen = <PlaceholderScreen stage={active} kicker={p.kicker} title={p.title} blurb={p.blurb} />;
  }

  return (
    <AppShell active={active} onNavigate={setActive} project={project?.name ?? null} bridged={isBridged()} version={VERSION}>
      {screen}
    </AppShell>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ProjectProvider>
          <Shell />
        </ProjectProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
