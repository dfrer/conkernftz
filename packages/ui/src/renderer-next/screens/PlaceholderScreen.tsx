import { EmptyState } from '../components/EmptyState';

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
      <div className="main-head">
        <div>
          <div className="label main-kicker">{kicker}</div>
          <h1 className="main-title">{title}</h1>
        </div>
      </div>
      <EmptyState code={`STAGE // ${stage.toUpperCase()}`} title={`${title} — under construction`} hint={blurb} />
    </div>
  );
}
