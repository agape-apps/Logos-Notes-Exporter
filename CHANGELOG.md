# Change Log

- Release v1.0.3: Initial beta release
- Release v1.0.4: correct Windows database search path from Logos4 to Logos directory
- Release v1.0.5: add SHA256 checksum files for binary integrity verification
- Release v1.0.6: implement catalog database integration to show resource titles
- Release v1.0.7: fix XAML to Markdown conversion for text formatting and headings
- Release v1.0.8: fix XAML to Markdown conversion for lists
- Release v1.0.9: various improvements to the XAML to Markdown conversion
- Release v1.1.0: restructure project as monorepo and add Electron app to the CLI version
- Release v1.2.0: improve Rich Text conversion, add image support, fix Electron build config 
- 2024-07-20: Updated dependencies and fixed an issue where the `dist` directory was not found during builds by adding a dedicated build step to the release workflow.
- 2025-07-23: Fix GitHub Actions release workflow by adding a missing build step for the CLI package. 
- 2025-07-23: Fixed GitHub Actions build error on Windows by removing redundant mkdir -p commands from npm scripts.
- 2025-07-23: Improved cross-platform compatibility by reverting to clean Unix commands and adding shell: bash to GitHub Actions workflow.
- Release v1.2.1: fix GitHub Actions release workflow
- 2025-07-23: Enhanced CLI --list-databases command to show both NotesTool and Catalog databases, removed unused development location
- 2025-07-23: Implemented cross-platform default export location using username/Documents/Logos-Exported-Notes for both CLI and Electron
- 2025-07-23: Fixed CLI and Electron output directory issues - CLI now correctly uses cross-platform Documents path, Electron webpack build resolved
- 2025-07-23: Added app icons to Electron app for macOS and Windows using 512x512 PNG configured in Electron Forge packagerConfig
- 2025-07-23: Fixed Electron app icon configuration - switched from electron-builder to Electron Forge packagerConfig with proper icon path
- 2025-07-23: Added icon to BrowserWindow constructor for development mode - Forge packagerConfig only applies to built apps, not dev mode
- 2025-07-23: Added installer-specific icon configurations to Forge makers (MakerSquirrel, MakerDeb, MakerRpm) for proper packaging
- 2025-07-23: Installed missing @electron-forge/shared-types package to fix TypeScript definitions
- 2025-07-23: fix: removed duplicate database detection messages in Electron app - eliminated redundant main process log, now shows clean 2-message flow
2025-07-23 - fix: UI layout improvements - 32px margins, 1024x700 min window, modern blue theme, simplified output log
2025-07-23 - fix: UI spacing corrections - exact 32px margins, proper button text sizing, forced blue theme colors with !important CSS overrides
2025-07-23 - fix: exact 32px bottom spacing, light gray inactive switches/tooltips
2025-07-24 - fix: comprehensive UI improvements - solid gray tooltips, centered header, left-aligned mode button, one-line database status, grayed database button when connected, dynamic settings status subtitle
2025-07-24 - fix: remaining UI spacing and output directory issues - corrected bottom spacing to exact 32px, fixed Electron to use absolute output directory path like CLI
2025-07-24 - fix: database connection lost during Electron hot reload - added automatic database state synchronization after main process restart
- 2025-07-24 fix: improved console logging and environment detection to eliminate misleading browser warnings in Electron renderer context
- 2025-07-24 fix: simplified environment detection in config module to prevent misleading browser warnings in Electron renderer context
- 2025-07-24 feat: enhanced notebook index files - renamed README.md to INDEX.md with inline note content, alphabetical sorting, and highlights support
- 2025-07-25: Implemented tab-to-indent conversion - leading tabs in XAML text are converted to user's preferred indent format (blockquotes or nbsp)
- 2025-07-26 refactor: complete rename from useAppStore to useStore including filename and documentation
- 2025-07-29 - feat: add default subfolder feature to prevent cluttering user directories with configurable subfolder name option in advanced settings
