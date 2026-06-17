import { describe, it, expect } from 'vitest';
import { editionToCompositeInputs } from '../render.js';
import type { GeneratedEdition } from '../generator.js';

describe('editionToCompositeInputs', () => {
  it('maps a plain pick to a full-canvas layer (no positioning)', () => {
    const ed: GeneratedEdition = {
      traits: { L: 'A' },
      picks: [{ layer: 'L', option: { filePath: 'a.png', value: 'A', weight: 1, blend: 'multiply', opacity: 0.5 } }],
    };
    const [input] = editionToCompositeInputs(ed);
    expect(input).toMatchObject({ path: 'a.png', blend: 'multiply', opacity: 0.5 });
    expect(input!.positionCenter).toBeUndefined();
  });

  it('applies a matching placement as a positioned overlay', () => {
    const ed: GeneratedEdition = {
      traits: { L: 'A' },
      picks: [{ layer: 'L', option: { filePath: 'a.png', value: 'A', weight: 1 } }],
      placements: [
        {
          layer: 'L',
          target: 'layer',
          patternId: 'p',
          dotId: 'd',
          left: 10,
          top: 20,
          centerX: 50,
          centerY: 60,
          rotationDeg: 30,
          assetValue: 'A',
          anchorNormalized: { x: 0.5, y: 0.5 },
        },
      ],
    };
    const [input] = editionToCompositeInputs(ed);
    expect(input!.positionCenter).toEqual({ x: 50, y: 60 });
    expect(input!.anchor).toEqual({ x: 0.5, y: 0.5 });
    expect(input!.rotateDeg).toBe(30);
    expect(input!.resizeMode).toBe('none');
  });
});
