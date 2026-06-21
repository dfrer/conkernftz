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
import { ExperienceScreen } from './screens/ExperienceScreen';
import { SiteScreen } from './screens/SiteScreen';
import { LaunchScreen } from './screens/LaunchScreen';
import { LaunchSolana } from './screens/LaunchSolana';
import { SettingsScreen } from './screens/SettingsScreen';
import { HelpScreen } from './screens/HelpScreen';
import { FalScreen } from './screens/FalScreen';
import { PacksScreen } from './screens/PacksScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { PlaygroundScreen } from './screens/PlaygroundScreen';
import { isBridged } from './lib/bridge';

const VERSION = '4.0.0';

const FALLBACK = { kicker: 'SYSTEM', title: 'Coming soon', blurb: 'This area is not built yet.' };

function Shell() {
  const [active, setActive] = useState('projects');
  const { project, config } = useProject();
  // Launch is chain-aware: Solana projects get the Candy Machine flow, EVM the contract flow.
  const solana = (config as { chain?: { target?: string } } | null)?.chain?.target === 'solana';

  let screen;
  if (active === 'projects') screen = <ProjectsScreen onOpened={() => setActive('design')} />;
  else if (active === 'design') screen = <DesignScreen />;
  else if (active === 'preview') screen = <PreviewScreen />;
  else if (active === 'build') screen = <BuildScreen />;
  else if (active === 'publish') screen = <PublishScreen />;
  else if (active === 'experience') screen = <ExperienceScreen />;
  else if (active === 'site') screen = <SiteScreen />;
  else if (active === 'launch') screen = solana ? <LaunchSolana /> : <LaunchScreen />;
  else if (active === 'settings') screen = <SettingsScreen />;
  else if (active === 'help') screen = <HelpScreen />;
  else if (active === 'ai') screen = <FalScreen />;
  else if (active === 'packs') screen = <PacksScreen />;
  else if (active === 'playground') screen = <PlaygroundScreen />;
  else screen = <PlaceholderScreen stage={active} kicker={FALLBACK.kicker} title={FALLBACK.title} blurb={FALLBACK.blurb} />;

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
