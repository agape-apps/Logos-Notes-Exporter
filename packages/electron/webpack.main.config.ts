import path from 'path';
import type { Configuration } from 'webpack';
import webpack from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/main.ts',
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    // Replace bun:sqlite with our database adapter
    new webpack.NormalModuleReplacementPlugin(
      /^bun:sqlite$/,
      path.resolve(__dirname, 'src/main/database-adapter.ts')
    ),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    alias: {
      '@logos-notes-exporter/config': path.resolve(__dirname, '../config/dist'),
    },
  },
  // Remove externals to let webpack handle better-sqlite3 properly
  target: 'electron-main',
};
