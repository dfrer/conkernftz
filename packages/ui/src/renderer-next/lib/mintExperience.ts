// Mint-experience engine (P1). A declarative, serializable description of the minting
// "reveal moment" — a card-pack rip-open, a flip-grid, or a simple fade. DOM-free and
// pure so it's unit-tested directly; the React player (components/MintExperience.tsx) is a
// thin renderer over this config, and the SAME config + player will drive the generated
// static mint site later (no drift between in-app preview and the shipped experience).

export type ExperienceKind = 'cardPack' | 'flip' | 'fade';

export interface ExperienceConfig {
  kind: ExperienceKind;
  /** Cards revealed per play. */
  packCount: number;
  /** Base animation duration (ms) — drives CSS timing. */
  durationMs: number;
  /** Pack / call-to-action label. */
  label: string;
  /** cardPack: the pack visibly shakes before it's ripped. */
  shake: boolean;
  /** Cards flip to their art automatically vs. requiring a tap each. */
  autoFlip: boolean;
  /** Optional custom card-back image (data URL) — resolved from backId at render/export. */
  backArt?: string;
  /** Optional pack-wrapper image (data URL) — resolved from packId at render/export. */
  packArt?: string;
  /** Runtime-only: the torn-open pack image (resolved from the pack's `-open` library variant). */
  packOpenArt?: string;
  /** Runtime-only: split-rip front piece (the pack face/pocket that covers the card bottoms). */
  packOpenFrontArt?: string;
  /** Runtime-only: split-rip back piece (the pack interior wall behind the cards). */
  packOpenBackArt?: string;
  /** App-level pack-library id (the canonical, lean reference stored in the project config). */
  packId?: string;
  /** App-level card-back-library id (the DEFAULT back for ordinary pulls). */
  backId?: string;
  /** Optional per-rarity card backs: a tier label → library back id (stored, lean). */
  rarityBacks?: RarityBack[];
  /** Runtime-only: tier label → resolved back image (filled by resolveExperienceArt). */
  tierBacks?: Record<string, string>;
  /** Optional accent color override (else the app/site theme accent). */
  accent?: string;
}

export interface RarityBack {
  /** Rarity tier label, e.g. "Rare", "Legendary". */
  tier: string;
  /** App-level card-back-library id used for cards of this tier. */
  backId: string;
  /** Fraction of the collection (0–1) the rarest tokens this tier covers; default 5% (see rarityTier). */
  share?: number;
}

export const EXPERIENCE_KINDS: ExperienceKind[] = ['cardPack', 'flip', 'fade'];

export const EXPERIENCE_PRESETS: Record<string, ExperienceConfig> = {
  classicPack: { kind: 'cardPack', packCount: 3, durationMs: 700, label: 'CONKER PACK', shake: true, autoFlip: false },
  holoPack: { kind: 'cardPack', packCount: 5, durationMs: 600, label: 'HOLO PACK', shake: true, autoFlip: true, accent: '#5fd0d6' },
  flipGrid: { kind: 'flip', packCount: 6, durationMs: 450, label: 'REVEAL', shake: false, autoFlip: false },
  quickFade: { kind: 'fade', packCount: 1, durationMs: 500, label: 'REVEAL', shake: false, autoFlip: true },
};

export const DEFAULT_EXPERIENCE: ExperienceConfig = EXPERIENCE_PRESETS.classicPack!;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Fill a partial/untrusted config with defaults, clamping numbers and validating the kind. */
export function resolveExperience(partial?: Partial<ExperienceConfig> | null): ExperienceConfig {
  const base = DEFAULT_EXPERIENCE;
  const p = (partial ?? {}) as Partial<ExperienceConfig>;
  const kind = EXPERIENCE_KINDS.includes(p.kind as ExperienceKind) ? (p.kind as ExperienceKind) : base.kind;
  const out: ExperienceConfig = {
    kind,
    packCount: clampInt(p.packCount, 1, 12, base.packCount),
    durationMs: clampInt(p.durationMs, 50, 5000, base.durationMs),
    label: typeof p.label === 'string' && p.label.trim() ? p.label : base.label,
    shake: typeof p.shake === 'boolean' ? p.shake : base.shake,
    autoFlip: typeof p.autoFlip === 'boolean' ? p.autoFlip : base.autoFlip,
  };
  // Preserve runtime-resolved art (data URLs filled by resolveExperienceArt). resolveExperience
  // sits on the site/export pass-through path and is called repeatedly, so it MUST NOT drop these
  // — otherwise the layered pack rip + rarity backs survive only in the Mint FX preview, not the
  // generated/exported site.
  if (typeof p.backArt === 'string' && p.backArt) out.backArt = p.backArt;
  if (typeof p.packArt === 'string' && p.packArt) out.packArt = p.packArt;
  if (typeof p.packOpenArt === 'string' && p.packOpenArt) out.packOpenArt = p.packOpenArt;
  if (typeof p.packOpenFrontArt === 'string' && p.packOpenFrontArt) out.packOpenFrontArt = p.packOpenFrontArt;
  if (typeof p.packOpenBackArt === 'string' && p.packOpenBackArt) out.packOpenBackArt = p.packOpenBackArt;
  if (p.tierBacks && typeof p.tierBacks === 'object') {
    const tb: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.tierBacks)) if (typeof v === 'string' && v) tb[k] = v;
    if (Object.keys(tb).length) out.tierBacks = tb;
  }
  if (typeof p.packId === 'string' && p.packId) out.packId = p.packId;
  if (typeof p.backId === 'string' && p.backId) out.backId = p.backId;
  if (Array.isArray(p.rarityBacks)) {
    const rules = p.rarityBacks.filter(
      (r): r is RarityBack => !!r && typeof r.tier === 'string' && !!r.tier.trim() && typeof r.backId === 'string' && !!r.backId,
    );
    if (rules.length)
      out.rarityBacks = rules.map((r) => ({
        tier: r.tier,
        backId: r.backId,
        ...(typeof r.share === 'number' && r.share > 0 && r.share <= 1 ? { share: r.share } : {}),
      }));
  }
  if (typeof p.accent === 'string' && p.accent) out.accent = p.accent;
  return out;
}

/** The call-to-action label for a given experience. */
export function revealLabel(config: ExperienceConfig): string {
  return config.kind === 'cardPack' ? 'Rip open' : 'Reveal';
}

/** Whether the experience opens from a sealed pack (vs. revealing cards directly). */
export function hasPack(config: ExperienceConfig): boolean {
  return config.kind === 'cardPack';
}
