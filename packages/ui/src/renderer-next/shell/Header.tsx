import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { RedactionStamp } from '../components/RedactionStamp';

export function Header({ project }: { project: string | null }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">
          CONKER<b>NFTZ</b>
        </span>
        <span className="brand-sub">Generative Art Foundry</span>
      </div>
      <div className="header-spacer" />
      <span className="label">{project ? `PROJECT // ${project}` : 'NO PROJECT LOADED'}</span>
      <div className="header-tools">
        <RedactionStamp />
        <Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle color theme">
          {theme === 'dark' ? '◐ DARK' : '◑ LIGHT'}
        </Button>
      </div>
    </header>
  );
}
