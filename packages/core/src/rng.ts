export interface SeededRng {
  next(): number; // [0,1)
  int(maxExclusive: number): number;
}

export function createSeededRng(seed: number | string): SeededRng {
  let state = typeof seed === 'number' ? (seed >>> 0) : hashStringToInt(seed);
  // xorshift32 has a degenerate all-zero state; remap 0 to a fixed non-zero constant
  if (state === 0) state = 0x9e3779b9; // golden ratio frac as 32-bit
  // xorshift32
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    // uint32 to [0,1)
    return ((state >>> 0) / 0xffffffff);
  };
  return {
    next,
    int(maxExclusive: number): number {
      if (maxExclusive <= 0) throw new Error('maxExclusive must be > 0');
      return Math.floor(next() * maxExclusive);
    },
  };
}

function hashStringToInt(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}


