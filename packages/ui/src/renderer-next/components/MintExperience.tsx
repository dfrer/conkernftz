import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { cx } from '../lib/cx';
import { Button } from './Button';
import { revealLabel, hasPack, type ExperienceConfig } from '../lib/mintExperience';

// Config-driven player for a mint "reveal moment". State is interaction-driven (open →
// flip), never timer-driven, so it's deterministic and testable; the staged look is pure
// CSS keyframes keyed off the kind. Renders the same way in the app preview and (later) the
// generated static mint site.
export function MintExperience({
  config,
  images = [],
  cardTiers = [],
  onComplete,
  className,
}: {
  config: ExperienceConfig;
  images?: string[];
  /** Per-card rarity tier label (parallel to images); selects a rarity-specific back. */
  cardTiers?: string[];
  onComplete?: () => void;
  className?: string;
}) {
  const count = Math.max(1, config.packCount);
  const [opened, setOpened] = useState(false);
  const [flipped, setFlipped] = useState<boolean[]>(() => Array(count).fill(false));
  const [pull, setPull] = useState(0); // 0..1 rip progress while dragging the pack
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number; delta: number } | null>(null);
  const completedRef = useRef(false);

  // Reset when the experience meaningfully changes (kind/count) — NOT on every new config
  // object, since the parent passes a freshly-resolved config each render, which would
  // otherwise snap a just-opened reveal back to idle.
  useEffect(() => {
    setOpened(false);
    setFlipped(Array(count).fill(false));
    setPull(0);
    setDragging(false);
    completedRef.current = false;
  }, [config.kind, count]);

  const open = (): void => {
    setOpened(true);
    if (config.autoFlip) setFlipped(Array(count).fill(true));
  };
  const flip = (i: number): void => setFlipped((prev) => (prev[i] ? prev : prev.map((v, j) => (j === i ? true : v))));
  const replay = (): void => {
    setOpened(false);
    setFlipped(Array(count).fill(false));
    setPull(0);
    setDragging(false);
    completedRef.current = false;
  };

  // Grab-and-pull rip: drag the pack upward; past the threshold it tears open. A plain
  // click/tap (negligible drag) or Enter/Space also opens it (accessible fallback).
  const RIP_THRESHOLD = 120;
  const onPackDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    dragRef.current = { startY: e.clientY, delta: 0 };
    setDragging(true);
    // Pointer capture keeps move/up events flowing if the cursor leaves the pack; it's a
    // nicety, so never let it break the interaction if the id is rejected.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture optional */
    }
  };
  const onPackMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragRef.current) return;
    const delta = Math.max(0, dragRef.current.startY - e.clientY);
    dragRef.current.delta = delta;
    setPull(Math.min(delta / RIP_THRESHOLD, 1));
  };
  const onPackUp = (): void => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (d && (d.delta >= RIP_THRESHOLD || d.delta < 6)) open();
    else setPull(0);
  };
  const onPackCancel = (): void => {
    dragRef.current = null;
    setDragging(false);
    setPull(0);
  };

  const allFlipped = opened && flipped.every(Boolean);
  useEffect(() => {
    if (allFlipped && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [allFlipped, onComplete]);

  const style = useMemo(() => {
    const s: Record<string, string> = { '--exp-dur': `${config.durationMs}ms` };
    if (config.accent) s['--exp-accent'] = config.accent;
    return s as CSSProperties;
  }, [config.durationMs, config.accent]);

  const cardArt = (i: number): string | undefined => (images.length ? images[i % images.length] : undefined);
  // A card's back: its rarity-tier back if one is mapped, else the default back, else the CSS mark.
  const cardBack = (i: number): string | undefined => {
    const tier = cardTiers[i];
    return (tier && config.tierBacks?.[tier]) || config.backArt || undefined;
  };

  const renderCard = (i: number) => {
    const isFlipped = !!flipped[i];
    const art = cardArt(i);
    const back = cardBack(i);
    return (
      <button
        key={i}
        type="button"
        className={cx('exp-card', isFlipped ? 'exp-card--face' : 'exp-card--back')}
        style={{ '--exp-i': i, '--exp-rot': `${(i - (count - 1) / 2) * 6}deg` } as CSSProperties}
        onClick={() => !isFlipped && flip(i)}
        aria-label={isFlipped ? `Card ${i + 1}` : `Reveal card ${i + 1}`}
        disabled={isFlipped}
      >
        {isFlipped ? (
          art ? (
            <img className="exp-card-art" src={art} alt={`Card ${i + 1}`} loading="lazy" />
          ) : (
            <span className="exp-card-ph">{i + 1}</span>
          )
        ) : back ? (
          <img className="exp-card-art" src={back} alt="" />
        ) : (
          <span className="exp-card-mark">◇</span>
        )}
      </button>
    );
  };

  const cards = Array.from({ length: count }, (_, i) => i);
  // The full rip stage (cards rise out of the torn-open pack) needs cardPack + a torn-open image.
  const ripStage = config.kind === 'cardPack' && !!config.packOpenArt;
  const replayRow = (
    <div className="row">
      <Button size="sm" variant="ghost" onClick={replay}>
        Replay
      </Button>
    </div>
  );

  return (
    <div className={cx('exp', `exp--${config.kind}`, className)} style={style} data-stage={opened ? 'revealing' : 'idle'}>
      {!opened ? (
        <div className="exp-idle">
          {hasPack(config) ? (
            <>
              <div
                className={cx('exp-pack', 'exp-pack--grab', dragging && 'exp-pack--dragging', !dragging && config.shake && 'exp-pack--shake')}
                role="button"
                tabIndex={0}
                aria-label="Rip open the pack"
                style={dragging ? ({ transform: `translateY(${-pull * 70}px) rotate(${pull * -5}deg)`, transition: 'none' } as CSSProperties) : undefined}
                onPointerDown={onPackDown}
                onPointerMove={onPackMove}
                onPointerUp={onPackUp}
                onPointerCancel={onPackCancel}
                onClick={() => open()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open();
                  }
                }}
              >
                {config.packArt ? (
                  <img className="exp-pack-art" src={config.packArt} alt="" draggable={false} />
                ) : (
                  <span className="exp-pack-label">{config.label}</span>
                )}
              </div>
              <span className="exp-hint label">{pull > 0 ? 'Keep pulling to rip' : 'Grab & pull to rip'}</span>
            </>
          ) : (
            <Button variant="primary" onClick={open}>
              {revealLabel(config)}
            </Button>
          )}
        </div>
      ) : ripStage ? (
        <div className="exp-stage">
          <div className="exp-rip">
            <div className="exp-rip-cards">{cards.map(renderCard)}</div>
            <img className="exp-rip-pack" src={config.packOpenArt} alt="" draggable={false} />
          </div>
          {replayRow}
        </div>
      ) : (
        <div className="exp-stage">
          <div className={cx('exp-cards', `exp-cards--${config.kind}`)}>{cards.map(renderCard)}</div>
          {replayRow}
        </div>
      )}
    </div>
  );
}
