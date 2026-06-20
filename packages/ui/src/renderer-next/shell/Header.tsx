import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { Lamp } from '../components/Lamp';
import { RedactionStamp } from '../components/RedactionStamp';

export function Header({ project }: { project: string | null }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">
          CONKER<b>NFTZ</b>
        </span>
        <span className="brand-sub">NFT Art Foundry</span>
      </div>
      <div className="header-spacer" />
      <div className="header-project" title={project ? `Active project: ${project}` : 'No project loaded'}>
        <Lamp state={project ? 'ok' : 'off'} />
        <span className="label">{project ?? 'No project'}</span>
      </div>
      <div className="header-tools">
        <RedactionStamp />
        <Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle color theme">
          {theme === 'dark' ? '◐ DARK' : '◑ LIGHT'}
        </Button>
      </div>
    </header>
  );
}
