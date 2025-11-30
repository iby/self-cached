import globals from 'globals';
import jsLint from '@eslint/js';
import tsLint from 'typescript-eslint';
import nodeLint from 'eslint-plugin-n';

export default [
  {
    ignores: ['product/', 'node_modules/'],
  },

  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.nodeBuiltin,
      },
    },
    settings: {
      node: { version: '>=20.0.0' },
    },
  },

  jsLint.configs.recommended,
  {
    rules: {
      'max-len': 'off',
      'object-curly-spacing': ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'space-before-function-paren': ['error', { named: 'never', anonymous: 'always', asyncArrow: 'always' }],
    },
  },

  ...tsLint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },

  nodeLint.configs['flat/recommended-module'],
  {
    rules: {
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
      'n/prefer-node-protocol': 'error',
    },
  },
];
