import { useTheme } from '../theme/ThemeProvider';
import { Lamp } from '../components/Lamp';

export function StatusBar({ project, bridged, version }: { project: string | null; bridged: boolean; version: string }) {
  const { theme } = useTheme();
  return (
    <footer className="statusbar">
      <span className="seg">
        <Lamp state={project ? 'ok' : 'off'} /> <b>PROJECT</b> {project ?? '—'}
      </span>
      <span className="div" />
      <span className="seg">
        <Lamp state={bridged ? 'ok' : 'danger'} /> <b>BRIDGE</b> {bridged ? 'ONLINE' : 'OFFLINE'}
      </span>
      <span className="div" />
      <span className="seg">
        <b>THEME</b> {theme.toUpperCase()}
      </span>
      <div className="header-spacer" />
      <span className="seg">CONKERNFTZ v{version}</span>
      <span className="div" />
      <span className="seg">
        <Lamp state="on" pulse /> READY
      </span>
    </footer>
  );
}
