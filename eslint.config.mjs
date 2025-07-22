import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  js.configs.recommended,
  
  // TypeScript files configuration
  {
    files: ['packages/**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: [
          './packages/cli/tsconfig.json',
          './packages/core/tsconfig.json',
          './packages/electron/tsconfig.json'
        ],
        noWarnOnMultipleProjects: true
      },
      globals: {
        ...globals.node,
        ...globals.es2020
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      'import': importPlugin
    },
    rules: {
      ...typescript.configs['recommended'].rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index'
          ],
          'newlines-between': 'ignore'
        }
      ]
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: [
            './packages/cli/tsconfig.json',
            './packages/core/tsconfig.json',
            './packages/electron/tsconfig.json'
          ],
          noWarnOnMultipleProjects: true
        }
      }
    }
  },

  // Electron-specific React configuration
  {
    files: ['packages/electron/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: [
          './packages/cli/tsconfig.json',
          './packages/core/tsconfig.json',
          './packages/electron/tsconfig.json'
        ],
        noWarnOnMultipleProjects: true,
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      'import': importPlugin,
      'react': react,
      'react-hooks': reactHooks
    },
    rules: {
      ...typescript.configs['recommended'].rules,
      ...react.configs['recommended'].rules,
      ...reactHooks.configs['recommended'].rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/react-in-jsx-scope': 'off', // React 18 JSX transform
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index'
          ],
          'newlines-between': 'ignore'
        }
      ]
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: [
            './packages/cli/tsconfig.json',
            './packages/core/tsconfig.json',
            './packages/electron/tsconfig.json'
          ],
          noWarnOnMultipleProjects: true
        }
      },
      react: {
        version: 'detect'
      }
    }
  },

  // Global ignores
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.webpack/',
      'packages/*/dist/',
      'packages/*/.webpack/',
      'packages/*/node_modules/',
      'packages/electron/webpack.*.ts',
      'packages/electron/forge.config.ts',
      'packages/electron/postcss.config.js',
      'packages/electron/tailwind.config.js',
      '*.d.ts'
    ]
  }
];