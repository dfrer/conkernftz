'use strict';
// Preserves a native ECMAScript dynamic import for the CommonJS Electron main
// process. tsc (module: CommonJS) downlevels `import()` to `require()`, which fails
// for ESM-only packages such as @conkernftz/core. This hand-written CommonJS module
// is not compiled by tsc, so its import() stays a real dynamic import at runtime —
// letting the engine service load core/chain packages by package specifier (resolved
// via their `exports` maps) instead of by filesystem path, and with no runtime build.
module.exports.dynamicImport = function dynamicImport(specifier) {
  return import(specifier);
};
