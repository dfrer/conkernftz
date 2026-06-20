import { useRef, useState } from 'react';
import type { SiteConfig } from './site';

const HISTORY_MAX = 100;

export interface SiteHistory {
  site: SiteConfig;
  /** Discrete edit — snapshots the prior state for undo. */
  setSite: (next: SiteConfig) => void;
  /** Transient update (e.g. a drag frame) — applied without a history entry. */
  setSiteLive: (next: SiteConfig) => void;
  /** Snapshot the current state ONCE before a transient burst (call at drag/resize start). */
  beginHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Undo/redo for the site config. Discrete edits go through `setSite` (which snapshots the prior
 * state); drags use `beginHistory()` once at the start + `setSiteLive` per frame, so one drag is
 * one undo step. Past/future live in refs (no re-render churn during drags); a version counter
 * forces a re-render on history changes so `canUndo`/`canRedo` stay current for button states.
 */
export function useSiteHistory(init: () => SiteConfig): SiteHistory {
  const [site, setSiteRaw] = useState<SiteConfig>(init);
  const past = useRef<SiteConfig[]>([]);
  const future = useRef<SiteConfig[]>([]);
  const [, bump] = useState(0);
  const rerender = (): void => bump((v) => v + 1);
  const pushPast = (snap: SiteConfig): void => {
    past.current.push(snap);
    if (past.current.length > HISTORY_MAX) past.current.shift();
    future.current = [];
  };
  const setSite = (next: SiteConfig): void => {
    pushPast(site);
    setSiteRaw(next);
    rerender();
  };
  const setSiteLive = (next: SiteConfig): void => setSiteRaw(next);
  const beginHistory = (): void => {
    pushPast(site);
    rerender();
  };
  const undo = (): void => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(site);
    setSiteRaw(prev);
    rerender();
  };
  const redo = (): void => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(site);
    setSiteRaw(next);
    rerender();
  };
  return { site, setSite, setSiteLive, beginHistory, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
