import globals from 'globals';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: ['**/*.debug.js', '**/*.min.js', 'node_modules/**']
  },
  ...compat.extends('eslint:recommended'),
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        describe: true,
        it: true,
        before: true,
        after: true,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      indent: ['error', 2],
      quotes: ['error', 'single'],
      'linebreak-style': ['error', 'unix'],
      semi: ['error', 'always'],
      strict: ['error', 'global'],
      curly: 'error',
      eqeqeq: 'error',
      'no-eval': 'error',
      'guard-for-in': 'error',
      'no-caller': 'error',
      'no-else-return': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-floating-decimal': 'error',
      'no-implied-eval': 'error',
      'no-labels': 'error',
      'no-with': 'error',
      'no-loop-func': 'warn',
      'no-redeclare': ['error', { builtinGlobals: true }],
      'no-delete-var': 'error',
      'no-shadow-restricted-names': 'error',
      'no-undef-init': 'error',
      'no-use-before-define': 'error',
      'no-unused-vars': ['error', { args: 'none' }],
      'no-undef': 'error',
      'global-require': 'off',
      'no-console': 'off',
    },
  },
];
