import sharp from 'sharp';

export async function makeContactSheet(
  imagePaths: string[],
  thumbSize: { width: number; height: number },
  grid: { columns: number; gap: number },
): Promise<Buffer> {
  const columns = grid.columns;
  const rows = Math.ceil(imagePaths.length / columns);
  const width = columns * thumbSize.width + (columns - 1) * grid.gap;
  const height = rows * thumbSize.height + (rows - 1) * grid.gap;

  // Start with a dark background
  let sheet = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#111111',
    },
  });

  const overlays: sharp.OverlayOptions[] = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const x = col * (thumbSize.width + grid.gap);
    const y = row * (thumbSize.height + grid.gap);
    const resized = await sharp(imagePaths[i]).resize(thumbSize.width, thumbSize.height, { fit: 'cover' }).toBuffer();
    overlays.push({ input: resized, top: y, left: x });
  }

  sheet = sheet.composite(overlays);
  return sheet.png().toBuffer();
}

export function generateRarityReport(
  editions: Array<{ traits: Record<string, string> }>,
): {
  traitCounts: Record<string, Record<string, number>>;
  editionCount: number;
} {
  const counts: Record<string, Record<string, number>> = {};
  for (const ed of editions) {
    for (const [trait_type, value] of Object.entries(ed.traits)) {
      if (!counts[trait_type]) counts[trait_type] = {};
      counts[trait_type][value] = (counts[trait_type][value] ?? 0) + 1;
    }
  }
  return { traitCounts: counts, editionCount: editions.length };
}

export async function makePlacementsOverlay(
  placements: Array<{ centerX: number; centerY: number; color?: string; radius?: number }>,
  size: { width: number; height: number },
  style?: { defaultColor?: string; radius?: number; opacity?: number },
): Promise<Buffer> {
  const width = size.width;
  const height = size.height;
  const color = style?.defaultColor || '#ff6adf';
  const radius = Math.max(1, Math.floor(style?.radius ?? 8));
  const opacity = Math.max(0, Math.min(1, style?.opacity ?? 0.4));
  // Build a single SVG with circles
  const circles = placements
    .map((p) => {
      const cx = Math.round(p.centerX);
      const cy = Math.round(p.centerY);
      const r = Math.max(1, Math.floor(p.radius ?? radius));
      const col = p.color || color;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" fill-opacity="${opacity}" stroke="${col}" stroke-opacity="${opacity}" stroke-width="1" />`;
    })
    .join('');
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="transparent"/>${circles}</svg>`,
    'utf8',
  );
  const sharp = (await import('sharp')).default;
  const overlay = await sharp(svg).png().toBuffer();
  const base = sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  return base.composite([{ input: overlay, left: 0, top: 0 }]).png().toBuffer();
}


