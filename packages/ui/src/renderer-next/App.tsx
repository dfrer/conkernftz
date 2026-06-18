import { useState } from 'react';
import { ThemeProvider } from './theme/ThemeProvider';
import { ToastProvider } from './components';
import { ProjectProvider, useProject } from './state/project';
import { AppShell } from './shell/AppShell';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { DesignScreen } from './screens/DesignScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { BuildScreen } from './screens/BuildScreen';
import { PublishScreen } from './screens/PublishScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HelpScreen } from './screens/HelpScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { PlaygroundScreen } from './screens/PlaygroundScreen';
import { isBridged } from './lib/bridge';

const VERSION = '4.0.0';

const PLACEHOLDERS: Record<string, { kicker: string; title: string; blurb: string }> = {
  ai: {
    kicker: 'SYSTEM // GENERATION',
    title: 'Fal AI',
    blurb: 'The Fal AI image-generation surface (model catalog + dynamic parameters) is ported in a later phase.',
  },
};

function Shell() {
  const [active, setActive] = useState('projects');
  const { project } = useProject();

  let screen;
  if (active === 'projects') screen = <ProjectsScreen onOpened={() => setActive('design')} />;
  else if (active === 'design') screen = <DesignScreen />;
  else if (active === 'preview') screen = <PreviewScreen />;
  else if (active === 'build') screen = <BuildScreen />;
  else if (active === 'publish') screen = <PublishScreen />;
  else if (active === 'settings') screen = <SettingsScreen />;
  else if (active === 'help') screen = <HelpScreen />;
  else if (active === 'playground') screen = <PlaygroundScreen />;
  else {
    const p = PLACEHOLDERS[active] ?? PLACEHOLDERS.ai!;
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
