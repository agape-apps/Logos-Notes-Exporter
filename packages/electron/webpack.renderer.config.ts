import * as path from 'path';
import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

rules.push({
  test: /\.css$/,
  use: [
    { loader: 'style-loader' }, 
    { loader: 'css-loader' },
    { loader: 'postcss-loader' }
  ],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@logos-notes-exporter/config': path.resolve(__dirname, '../config/dist'),
    },
  },
  // DEVELOPMENT FIX: Disable aggressive file watching that triggers hot reload
  watchOptions: {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/out/**',
      '**/Documents/**', // Ignore user Documents folder where exports are created
      '**/*.db',         // Ignore database files
      '**/.webpack/**',
      '**/settings.yaml', // Ignore settings file changes
    ],
    aggregateTimeout: 1000, // Delay before rebuilding
    poll: false, // Disable polling for file changes
  },
};
