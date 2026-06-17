import { useState } from 'react';
import { cx } from '../lib/cx';

// The NORTHAMERICANSURVEILLANCEASSOCIATION easter egg, reimagined as a redacted dossier
// stamp: a black bar that lifts to reveal the agency name on click.
export function RedactionStamp() {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      className={cx('redaction', revealed && 'revealed')}
      onClick={() => setRevealed((v) => !v)}
      title="NORTHAMERICANSURVEILLANCEASSOCIATION"
      aria-pressed={revealed}
    >
      {revealed ? (
        'NORTHAMERICANSURVEILLANCEASSOCIATION'
      ) : (
        <>
          FILE&nbsp;<span className="bar">CLASSIFIED // NASA</span>
        </>
      )}
    </button>
  );
}
