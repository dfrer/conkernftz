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
      // TypeScript's type checker handles undefined-symbol detection; the core
      // rule produces false positives on Node/DOM globals in .ts files.
      'no-undef': 'off',
      // Best-effort cleanup (e.g. unlinking files that may not exist) legitimately
      // uses empty catch blocks; other empty blocks remain errors.
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    },
  },
  prettier,
);
