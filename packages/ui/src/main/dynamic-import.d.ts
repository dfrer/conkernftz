// Types for the hand-written dynamic-import.js runtime helper.
export function dynamicImport<T = unknown>(specifier: string): Promise<T>;
