import { cx } from '../lib/cx';
import { Lamp } from '../components/Lamp';
import { PIPELINE, UTILITY } from './stages';

export function PipelineNav({ active, onNavigate }: { active: string; onNavigate: (id: string) => void }) {
  const item = (id: string, label: string, index?: string) => (
    <button
      key={id}
      type="button"
      className={cx('nav-item', active === id && 'active')}
      onClick={() => onNavigate(id)}
      aria-current={active === id ? 'page' : undefined}
    >
      <span className="nav-index">{index ?? '··'}</span>
      <span className="nav-label">{label}</span>
      <Lamp state={active === id ? 'on' : 'off'} />
    </button>
  );

  return (
    <nav className="nav" aria-label="Primary">
      {item('projects', 'Projects', '00')}
      <div className="nav-sep" />
      <div className="nav-heading label">Pipeline</div>
      {PIPELINE.map((s, i) => item(s.id, s.label, String(i + 1).padStart(2, '0')))}
      <div className="nav-sep" />
      <div className="nav-heading label">System</div>
      {UTILITY.map((s) => item(s.id, s.label))}
    </nav>
  );
}
