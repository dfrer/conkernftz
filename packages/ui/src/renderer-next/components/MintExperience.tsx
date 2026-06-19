import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { cx } from '../lib/cx';
import { Button } from './Button';
import { revealLabel, hasPack, type ExperienceConfig } from '../lib/mintExperience';

// Config-driven player for a mint "reveal moment". Interaction-driven (rip → pull → flip),
// never timer-driven, so it's deterministic and testable; the staged look is pure CSS keyed
// off the phase/kind. Renders the same in the app preview and the generated static mint site.
//
// Rip flow (cardPack + a torn-open pack image):
//   sealed → (grab/pull/click) tearing → (tear anim ends) stacked → (click) spilled → flip cards.
// Other kinds (or a pack without a torn-open image) go straight sealed → spilled.
type RipPhase = 'sealed' | 'tearing' | 'stacked' | 'spilled';

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
  // Rip art: prefer the split front/back pieces (true cards-inside-the-pack pocket); fall back
  // to a single torn-open image. `openArt` is the tear-beat crossfade target.
  const layered = !!config.packOpenFrontArt;
  const openArt = config.packOpenFrontArt || config.packOpenArt;
  // The full rip flow (tear → cards-stacked-in-pack → spill) needs cardPack + any torn-open art.
  const ripStage = config.kind === 'cardPack' && !!openArt;
  const [phase, setPhase] = useState<RipPhase>('sealed');
  const [flipped, setFlipped] = useState<boolean[]>(() => Array(count).fill(false));
  const [pull, setPull] = useState(0); // 0..1 rip progress while dragging the pack
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number; delta: number } | null>(null);
  const completedRef = useRef(false);

  // Reset when the experience meaningfully changes (kind/count) — NOT on every new config
  // object, since the parent passes a freshly-resolved config each render, which would
  // otherwise snap a just-opened reveal back to idle.
  const reset = (): void => {
    setPhase('sealed');
    setFlipped(Array(count).fill(false));
    setPull(0);
    setDragging(false);
    completedRef.current = false;
  };
  useEffect(reset, [config.kind, count]);

  const autoFlipMaybe = (): void => {
    if (config.autoFlip) setFlipped(Array(count).fill(true));
  };
  // Rip trigger: tear first (if we have a sealed image to tear), else go straight to the stack.
  const open = (): void => {
    if (ripStage) setPhase(config.packArt ? 'tearing' : 'stacked');
    else {
      setPhase('spilled');
      autoFlipMaybe();
    }
  };
  // Pull the stacked cards out of the open pack.
  const spill = (): void => {
    setPhase('spilled');
    autoFlipMaybe();
  };
  const flip = (i: number): void => setFlipped((prev) => (prev[i] ? prev : prev.map((v, j) => (j === i ? true : v))));

  // Grab-and-pull rip: drag the pack upward; past the threshold it tears open. A plain
  // click/tap (negligible drag) or Enter/Space also opens it (accessible fallback).
  const RIP_THRESHOLD = 120;
  const onPackDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    dragRef.current = { startY: e.clientY, delta: 0 };
    setDragging(true);
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
    if (d && d.delta >= RIP_THRESHOLD) open();
    else setPull(0);
  };
  const onPackCancel = (): void => {
    dragRef.current = null;
    setDragging(false);
    setPull(0);
  };

  const allFlipped = phase === 'spilled' && flipped.every(Boolean);
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
    const off = i - (count - 1) / 2; // centered index (e.g. -1, 0, 1) → fan direction/spread
    return (
      <button
        key={i}
        type="button"
        className={cx('exp-card', isFlipped ? 'exp-card--face' : 'exp-card--back')}
        // --exp-off drives the horizontal fan spread; --exp-rot the per-card tilt.
        style={{ '--exp-i': i, '--exp-off': off, '--exp-rot': `${off * 6}deg` } as CSSProperties}
        // In the stacked phase a card click pulls the whole stack out; once spilled, it flips.
        onClick={() => (phase === 'stacked' ? spill() : !isFlipped && flip(i))}
        aria-label={phase === 'stacked' ? 'Pull the cards out' : isFlipped ? `Card ${i + 1}` : `Reveal card ${i + 1}`}
        disabled={isFlipped && phase === 'spilled'}
      >
        {/* Inner wrapper isolates the gentle floating idle from the card's positioning transform. */}
        <span className="exp-card-inner">
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
        </span>
      </button>
    );
  };

  const cards = Array.from({ length: count }, (_, i) => i);
  const replayRow = (
    <div className="row">
      <Button size="sm" variant="ghost" onClick={reset}>
        Replay
      </Button>
    </div>
  );

  return (
    <div className={cx('exp', `exp--${config.kind}`, className)} style={style} data-stage={phase === 'sealed' ? 'idle' : 'revealing'}>
      {phase === 'sealed' ? (
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
      ) : ripStage && phase === 'tearing' ? (
        <div className="exp-stage">
          <div className="exp-tear">
            <img className="exp-tear-open" src={openArt} alt="" draggable={false} />
            <img className="exp-tear-sealed" src={config.packArt} alt="" draggable={false} onAnimationEnd={() => setPhase('stacked')} />
            <span className="exp-tear-flash" aria-hidden />
          </div>
        </div>
      ) : ripStage ? (
        <div className="exp-stage">
          <div className={cx('exp-rip', layered && 'exp-rip--layered', phase === 'spilled' ? 'exp-rip--spilled' : 'exp-rip--stacked')}>
            {layered ? (
              <>
                {/* back wall (behind cards) → cards → front pocket (covers card bottoms) */}
                {config.packOpenBackArt ? <img className="exp-rip-back" src={config.packOpenBackArt} alt="" draggable={false} /> : null}
                <div className="exp-rip-cards">{cards.map(renderCard)}</div>
                <img
                  className="exp-rip-front"
                  src={config.packOpenFrontArt}
                  alt=""
                  draggable={false}
                  onClick={phase === 'stacked' ? spill : undefined}
                />
              </>
            ) : (
              <>
                <div className="exp-rip-cards">{cards.map(renderCard)}</div>
                <img className="exp-rip-pack" src={config.packOpenArt} alt="" draggable={false} onClick={phase === 'stacked' ? spill : undefined} />
              </>
            )}
          </div>
          {phase === 'stacked' ? <span className="exp-hint label">Click to pull the cards out</span> : replayRow}
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
