import { describe, it, expect } from 'vitest';
import { createRuleEngine } from '../../src/rules.js';

describe('rule engine', () => {
  const engine = createRuleEngine({
    mutuallyExclusive: [["Eyes:Laser", "Headwear:Visor"]],
    requires: [{ if: 'Headwear:Crown', thenAnyOf: ['Background:Royal', 'Background:Gold'] }],
  });

  it('ok when no violations', () => {
    expect(engine.validate({ Eyes: 'Laser', Background: 'Royal' })).toEqual({ ok: true });
  });

  it('detects mutual exclusion', () => {
    const r = engine.validate({ Eyes: 'Laser', Headwear: 'Visor' });
    expect(r.ok).toBe(false);
  });

  it('detects requires', () => {
    const r = engine.validate({ Headwear: 'Crown', Background: 'Blue' });
    expect(r.ok).toBe(false);
  });
});


