import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  const completedRef = useRef(false);

  // Reset whenever the config or card count changes (e.g. switching presets in the editor).
  useEffect(() => {
    setOpened(false);
    setFlipped(Array(count).fill(false));
    completedRef.current = false;
  }, [config, count]);

  const open = (): void => {
    setOpened(true);
    if (config.autoFlip) setFlipped(Array(count).fill(true));
  };
  const flip = (i: number): void => setFlipped((prev) => (prev[i] ? prev : prev.map((v, j) => (j === i ? true : v))));
  const replay = (): void => {
    setOpened(false);
    setFlipped(Array(count).fill(false));
    completedRef.current = false;
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

  return (
    <div className={cx('exp', `exp--${config.kind}`, className)} style={style} data-stage={opened ? 'revealing' : 'idle'}>
      {!opened ? (
        <div className="exp-idle">
          {hasPack(config) ? (
            <div className={cx('exp-pack', config.shake && 'exp-pack--shake')} aria-hidden>
              {config.packArt ? (
                <img className="exp-pack-art" src={config.packArt} alt="" />
              ) : (
                <span className="exp-pack-label">{config.label}</span>
              )}
            </div>
          ) : null}
          <Button variant="primary" onClick={open}>
            {revealLabel(config)}
          </Button>
        </div>
      ) : (
        <div className="exp-stage">
          <div className={cx('exp-cards', `exp-cards--${config.kind}`)}>
            {Array.from({ length: count }).map((_, i) => {
              const isFlipped = !!flipped[i];
              const art = cardArt(i);
              const back = cardBack(i);
              return (
                <button
                  key={i}
                  type="button"
                  className={cx('exp-card', isFlipped ? 'exp-card--face' : 'exp-card--back')}
                  style={{ '--exp-i': i } as CSSProperties}
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
            })}
          </div>
          <div className="row">
            <Button size="sm" variant="ghost" onClick={replay}>
              Replay
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
