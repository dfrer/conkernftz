// React's act() helper expects this flag under a test runner; without it, manual act()
// calls (used to dispatch simulated IPC progress events) warn. Harmless for the
// non-React main-process tests.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
