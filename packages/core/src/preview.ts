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


