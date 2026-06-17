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
      'packages/chain-evm/src/artifact.ts',
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
      // Opinionated style rules are warnings (not errors) so they surface issues
      // without blocking the build on pre-existing code; tighten over time.
      'prefer-const': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
    },
  },
  prettier,
);
