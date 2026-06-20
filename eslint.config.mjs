// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.d.ts',
      'packages/ui/src/index.html',
      'packages/chain-evm/contracts/**',
      // Auto-generated contract artifacts (ABI + bytecode) — not hand-edited, not linted.
      'packages/chain-evm/src/artifact.ts',
      'packages/chain-evm/src/launch-artifact.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // TypeScript's type checker handles undefined-symbol detection.
      'no-undef': 'off',
      // Best-effort cleanup legitimately uses empty catch blocks.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // These are now clean across the codebase, so they are errors to prevent regressions.
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Still warnings while remaining packages (cli/chain-solana) are tightened over time.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
    },
  },
  prettier,
);
