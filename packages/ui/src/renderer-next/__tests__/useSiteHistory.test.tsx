import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSiteHistory } from '../lib/useSiteHistory';
import { defaultSite, addBlock } from '../lib/site';

afterEach(cleanup);

describe('useSiteHistory', () => {
  it('setSite records history; undo and redo restore', () => {
    const { result } = renderHook(() => useSiteHistory(() => defaultSite()));
    const n0 = result.current.site.blocks.length;
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.setSite(addBlock(result.current.site, 'blink')));
    expect(result.current.site.blocks.length).toBe(n0 + 1);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.site.blocks.length).toBe(n0);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.site.blocks.length).toBe(n0 + 1);
  });

  it('a drag (beginHistory + setSiteLive frames) collapses to ONE undo step', () => {
    const { result } = renderHook(() => useSiteHistory(() => defaultSite()));
    const start = result.current.site;
    act(() => result.current.beginHistory()); // drag start: snapshot once
    act(() => result.current.setSiteLive(addBlock(start, 'blink'))); // frame 1 (no history)
    act(() => result.current.setSiteLive(addBlock(addBlock(start, 'blink'), 'marquee'))); // frame 2
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.site).toEqual(start); // one undo reverts the whole drag
  });

  it('a new edit clears the redo stack', () => {
    const { result } = renderHook(() => useSiteHistory(() => defaultSite()));
    const base = result.current.site;
    act(() => result.current.setSite(addBlock(base, 'blink')));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.setSite(addBlock(base, 'marquee')));
    expect(result.current.canRedo).toBe(false);
  });
});
