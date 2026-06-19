import { useEffect } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

/**
 * Full-size image inspector over a base64 image set. Controlled by the parent (index + setter)
 * so it works for any gallery (live previews, built editions, …). Arrow keys page; Dialog adds
 * Escape-to-close and click-outside.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
  mime = 'image/png',
  labelPrefix = 'Image',
}: {
  images: string[];
  index: number | null;
  onIndexChange: (i: number | null) => void;
  onClose: () => void;
  mime?: string;
  labelPrefix?: string;
}) {
  const step = (delta: number) => {
    if (index == null || images.length === 0) return;
    onIndexChange((index + delta + images.length) % images.length);
  };

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images.length]);

  return (
    <Dialog
      open={index != null}
      title={index != null ? `${labelPrefix} ${index + 1} / ${images.length}` : ''}
      onClose={onClose}
    >
      {index != null && images[index] ? (
        <div className="stack">
          <img className="lightbox-img" src={`data:${mime};base64,${images[index]}`} alt={`${labelPrefix} ${index + 1}`} />
          <div className="row spread">
            <Button onClick={() => step(-1)} disabled={images.length < 2} aria-label="Previous image">
              ‹ Prev
            </Button>
            <span className="mono muted">{mime.replace('image/', '').toUpperCase()}</span>
            <Button onClick={() => step(1)} disabled={images.length < 2} aria-label="Next image">
              Next ›
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
