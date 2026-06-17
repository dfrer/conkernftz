import type { ReactNode } from 'react';
import { Header } from './Header';
import { PipelineNav } from './PipelineNav';
import { StatusBar } from './StatusBar';

export function AppShell({
  active,
  onNavigate,
  project,
  bridged,
  version,
  children,
}: {
  active: string;
  onNavigate: (id: string) => void;
  project: string | null;
  bridged: boolean;
  version: string;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <Header project={project} />
      <PipelineNav active={active} onNavigate={onNavigate} />
      <main className="main">{children}</main>
      <StatusBar project={project} bridged={bridged} version={version} />
    </div>
  );
}
