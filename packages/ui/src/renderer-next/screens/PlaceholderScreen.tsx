import { EmptyState } from '../components/EmptyState';
import { StageHeader } from '../components/StageHeader';

export function PlaceholderScreen({
  stage,
  kicker,
  title,
  blurb,
}: {
  stage: string;
  kicker: string;
  title: string;
  blurb: string;
}) {
  return (
    <div className="stack stagger">
      <StageHeader kicker={kicker} title={title} />
      <EmptyState code={`STAGE // ${stage.toUpperCase()}`} title={`${title} — under construction`} hint={blurb} />
    </div>
  );
}
