export function Skeleton({ w = '100%', h = 14, r = 3 }: { w?: number | string; h?: number | string; r?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} aria-hidden />;
}
