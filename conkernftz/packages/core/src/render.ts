import type { CompositeLayerInput } from './compositor.js';
import type { GeneratedEdition } from './generator.js';

/**
 * Convert a generated edition's picks — honoring any pattern placements — into
 * compositor layer inputs. Shared by both `build` and `preview` so that previews
 * are WYSIWYG with the final build output.
 */
export function editionToCompositeInputs(ed: GeneratedEdition): CompositeLayerInput[] {
  return ed.picks.map((p): CompositeLayerInput => {
    const placement = Array.isArray(ed.placements)
      ? ed.placements.find(
          (pl) => pl.layer === p.layer && (pl.assetValue ? pl.assetValue === p.option.value : true),
        )
      : undefined;
    if (placement) {
      return {
        path: p.option.filePath,
        blend: p.option.blend ?? 'normal',
        opacity: p.option.opacity ?? 1,
        positionCenter: { x: placement.centerX, y: placement.centerY },
        anchor: placement.anchorNormalized ?? { x: 0.5, y: 0.5 },
        rotateDeg: placement.rotationDeg,
        resizeMode: 'none',
      };
    }
    return {
      path: p.option.filePath,
      blend: p.option.blend ?? 'normal',
      opacity: p.option.opacity ?? 1,
    };
  });
}
