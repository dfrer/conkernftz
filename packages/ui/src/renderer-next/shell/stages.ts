export interface Stage {
  id: string;
  label: string;
}

/** The guided creator pipeline (the heart of the new IA). */
export const PIPELINE: Stage[] = [
  { id: 'design', label: 'Design' },
  { id: 'preview', label: 'Preview' },
  { id: 'build', label: 'Build' },
  { id: 'publish', label: 'Publish' },
  { id: 'experience', label: 'Mint FX' },
  { id: 'site', label: 'Site' },
];

/** System / utility destinations. */
export const UTILITY: Stage[] = [
  { id: 'ai', label: 'Fal AI' },
  { id: 'packs', label: 'Packs' },
  { id: 'settings', label: 'Settings' },
  { id: 'help', label: 'Help' },
  { id: 'playground', label: 'Components' },
];

export const ALL_STAGE_IDS = ['projects', ...PIPELINE.map((s) => s.id), ...UTILITY.map((s) => s.id)];
