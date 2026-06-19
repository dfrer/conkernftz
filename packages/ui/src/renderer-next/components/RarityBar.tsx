import { formatPct } from '../lib/traits';

export interface RaritySegment {
  value: string;
  probability: number;
}

/**
 * Compact stacked bar showing a layer's trait-weight distribution. Equal segments read as a
 * balanced layer; one dominant segment reads as skewed — an at-a-glance rarity check without
 * expanding the layer. Presentational only; fed by computeTraitTable.
 */
export function RarityBar({ rows }: { rows: RaritySegment[] }) {
  if (rows.length === 0) {
    return <span className="rarity-bar rarity-bar--empty" aria-hidden />;
  }
  const title = rows
    .slice()
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 8)
    .map((r) => `${r.value} ${formatPct(r.probability)}`)
    .join(' · ');
  return (
    <span className="rarity-bar" role="img" aria-label={`Rarity distribution — ${title}`} title={title}>
      {rows.map((r, i) => (
        <span key={i} className="rarity-seg" style={{ width: `${Math.max(r.probability * 100, 0.5)}%` }} />
      ))}
    </span>
  );
}
