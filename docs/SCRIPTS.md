# Scripts Documentation

This document provides comprehensive documentation for all scripts in the Logos Notes Exporter monorepo.

## Root Package Scripts (`package.json`)

### Build Scripts
- **`build`** - Builds all packages in correct dependency order
  - Executes: `build:config`, `build:core`, `build:cli`, `build:electron`
  - Dependencies: TypeScript compilation for all packages
  
- **`build:config`** - Builds configuration package only
  - Filters to `@logos-notes-exporter/config` package
  
- **`build:core`** - Builds core package (depends on config)
  - Runs `build:config` first, then builds core package
  
- **`build:cli`** - Builds CLI package only
  - Filters to `@logos-notes-exporter/cli` package
  
- **`build:electron`** - Builds Electron package only
  - Filters to `@logos-notes-exporter/electron` package

### Development Scripts
- **`dev:cli`** - Runs CLI in development mode
  - Uses Bun runtime directly on source files
  
- **`dev:electron`** - Runs Electron app in development mode
  - Uses Electron Forge with webpack hot reload
  
- **`start`** - Alias for `dev:electron`
  - Primary entry point for desktop app development

### Binary Creation Scripts
- **`binary:all`** - Creates binaries for all platforms
  - Delegates to CLI package `binary:all` script

### Testing Scripts
- **`test:all`** - Comprehensive test suite with graceful fallback
  - Runs CLI tests and provides helpful messaging for missing tests

### Linting Scripts
- **`lint`** - Lints all packages using ESLint
  - Targets `packages/` directory
  
- **`lint:fix`** - Auto-fixes linting issues across all packages
  
- **`lint:cli`** - Lints CLI package only
  
- **`lint:core`** - Lints core package only
  
- **`lint:electron`** - Lints Electron package only

### Validation Scripts
- **`validate:deps`** - Verifies config package is built
  - Checks for `packages/config/dist` directory existence
  
- **`validate:core`** - Verifies core package is built
  - Checks for `packages/core/dist` directory existence
  
- **`validate:build`** - Combined dependency validation
  - Runs both `validate:deps` and `validate:core`
  
- **`validate`** - Pre-commit validation pipeline
  - Comprehensive check: lint → build → test with success confirmation

### Maintenance Scripts
- **`clean`** - Complete cleanup of all build artifacts
  - Removes: `node_modules`, `pnpm-lock.yaml`, `dist/`, `.webpack/`, `tsconfig.tsbuildinfo`
  
- **`reinstall`** - Full reinstallation workflow
  - Runs `clean`, then `pnpm install`, then builds config and core packages

## CLI Package Scripts (`packages/cli/package.json`)

### Development Scripts
- **`dev`** - Runs CLI directly with Bun on source files
  - Command: `bun run src/cli.ts`
  
- **`export`** - Alias for `dev` script
  - Provides semantic naming for export operations

### Build Scripts
- **`build`** - Compiles TypeScript and creates Bun executable
  - Two-step process: TypeScript compilation + Bun bundling
  
- **`start`** - Runs compiled CLI from dist folder
  - Uses built version instead of source

### Validation Scripts
- **`validate:binary`** - Verifies CLI is built before binary creation
  - Checks for `dist/` directory existence

### Binary Creation Scripts
- **`binary:macx64`** - Creates standalone macOS x64 binary
  - Pre-validates build, creates output directory, builds binary with success confirmation
  - Output: `../../bin/macos-x64/Logos-Notes-Exporter`
  
- **`binary:macarm`** - Creates standalone macOS ARM64 binary
  - Pre-validates build, creates output directory, builds binary with success confirmation
  - Output: `../../bin/macos-arm64/Logos-Notes-Exporter`
  
- **`binary:windows`** - Creates standalone Windows x64 binary
  - Pre-validates build, creates output directory, builds binary with success confirmation
  - Output: `../../bin/windows-x64/Logos-Notes-Exporter.exe`
  
- **`binary:all`** - Creates binaries for all platforms sequentially
  - Builds macOS x64, macOS ARM64, and Windows x64 binaries with comprehensive status reporting

### Testing & Maintenance
- **`test`** - Runs Bun test suite
- **`clean`** - Removes build artifacts
  - Deletes `dist/` and `tsconfig.tsbuildinfo`

## Config Package Scripts (`packages/config/package.json`)

### Build Scripts
- **`build`** - TypeScript compilation only
  - Simple `tsc` command for library compilation

### Maintenance Scripts
- **`clean`** - Removes build artifacts
  - Deletes `dist/` and `tsconfig.tsbuildinfo` with standardized syntax

## Core Package Scripts (`packages/core/package.json`)

### Build Scripts
- **`build`** - TypeScript compilation
  - Compiles core business logic library
  
- **`dev`** - TypeScript watch mode
  - Enables real-time compilation during development

### Maintenance Scripts
- **`clean`** - Removes build artifacts
  - Deletes `dist/` and `tsconfig.tsbuildinfo`

## Electron Package Scripts (`packages/electron/package.json`)

### Development Scripts
- **`kill-all`** - Terminates all Electron processes and frees port 3000
  - Kills: `electron-forge`, `Electron Helper`, `Electron` processes
  - Frees port 3000 for clean restart
  
- **`start`** - Starts Electron app in development mode
  - Runs `kill-all` first, then `electron-forge start`

### Build & Distribution Scripts
- **`rebuild`** - Rebuilds native modules for current platform
  - Uses `electron-rebuild` for native dependencies
  
- **`package`** - Creates distributable package
  - Uses Electron Forge packaging
  
- **`make`** - Creates installers for current platform
  - Generates platform-specific installers (dmg, exe, deb, rpm)
  
- **`publish`** - Publishes built packages
  - Uses Electron Forge publishing workflow

### Maintenance Scripts
- **`clean`** - Removes build artifacts
  - Deletes `.webpack/`, `dist/`, and `tsconfig.tsbuildinfo`

## Release Script (`scripts/create-release.sh`)

### Purpose
Automates git tag creation and release process

### Functionality
1. **Version Extraction** - Parses version from root `package.json`
2. **Duplicate Check** - Ensures git tag doesn't already exist locally
3. **Changelog Validation** - Verifies changelog entry exists for version
4. **Tag Creation** - Creates and pushes git tag with version

### Requirements
- Version must be updated in `package.json`
- Changelog entry must exist in last 3 lines of `CHANGELOG.md`

## Analysis & Evaluation

### ✅ Strengths
1. **Clear Dependency Management** - Root build script follows correct package dependency order
2. **Comprehensive Coverage** - Scripts cover development, building, testing, and distribution
3. **Platform Support** - Binary creation for multiple platforms (macOS x64/ARM, Windows)
4. **Clean Separation** - Each package has appropriate scripts for its purpose
5. **Development Workflow** - Good hot-reload support for both CLI and Electron

### ✅ Issues Resolved

#### 1. **Fixed Changelog Reference** ✅
- ~~`create-release.sh` references `CHANGES.md` but actual file is `CHANGELOG.md`~~
- **FIXED**: Updated script to reference correct `CHANGELOG.md` file

#### 2. **Removed Misleading Test Scripts** ✅
- ~~`test:electron` and `test:cli` are just aliases for dev scripts~~
- **FIXED**: Removed confusing aliases, added proper `test:all` script

#### 3. **Standardized Clean Scripts** ✅
- ~~Different clean implementations across packages~~
- **FIXED**: All packages now use consistent `rm -rf dist && rm -f tsconfig.tsbuildinfo` syntax

### ⚠️ Remaining Issues

#### 1. **Missing Test Implementation**
- CLI has `test` script but no actual tests exist
- **Status**: Placeholder `test:all` script ready for future implementation
- **Impact**: `test:all` provides graceful fallback messaging

#### 2. **Process Management**
- `kill-all` script is overly aggressive and platform-specific
- **Status**: Not addressed (marked as SKIP in implementation)
- **Impact**: May kill unrelated processes

### ✅ Implemented Improvements

#### High Priority ✅
1. **Fixed Release Script** ✅
   - Updated `create-release.sh` line 14 to reference `CHANGELOG.md`

2. **Removed Misleading Test Aliases** ✅
   - Removed confusing `test:electron` and `test:cli` aliases
   - Added proper `test:all` script with graceful fallback

3. **Standardized Clean Scripts** ✅
   - All packages now use consistent syntax: `rm -rf dist && rm -f tsconfig.tsbuildinfo`
   - Added missing clean script to Electron package

#### Medium Priority ✅
4. **Added Pre-build Validation** ✅
   - `validate:deps` - Verifies config package built
   - `validate:core` - Verifies core package built  
   - `validate:build` - Combined dependency validation
   - `validate:binary` - Validates CLI build before binary creation

5. **Enhanced Binary Scripts** ✅
   - Added directory creation (`mkdir -p`) for output paths
   - Added success confirmation messages
   - Pre-build validation before binary creation
   - Created `binary:all` for multi-platform creation

### 🔧 Remaining Improvements

#### Future Enhancements
1. **Implement Actual Tests**
   - Add proper test files for CLI package
   - Expand `test:all` to run comprehensive test suites

2. **Improve Process Management** (Skipped)
   - Replace aggressive `kill-all` with more targeted process management
   - Use cross-platform solutions

3. **Script Organization**
   - Group related scripts together
   - Add script descriptions in package.json

### ✅ Implemented Script Additions

1. **`test:all`** ✅ - Comprehensive test suite with graceful fallback
2. **`binary:all`** ✅ - Multi-platform binary creation (CLI + root wrapper)
3. **`validate`** ✅ - Pre-commit validation pipeline (lint + build + test)
4. **`validate:deps`** ✅ - Dependency validation for config package
5. **`validate:core`** ✅ - Dependency validation for core package
6. **`validate:build`** ✅ - Combined dependency validation
7. **`validate:binary`** ✅ - Pre-binary creation validation

### 📋 Future Script Additions

1. **`dev:all`** - Run both CLI and Electron in parallel (removed during implementation)
2. **`deps:check`** - Check for outdated dependencies

### 🏗️ Monorepo Optimization

The current script structure is well-suited for the monorepo architecture but could benefit from:
- Centralized script management using tools like `nx` or `turbo`
- Parallel execution for independent tasks
- Better dependency graph visualization
- Cached builds to avoid unnecessary rebuilds

### 💡 Best Practices Compliance

**Following:** ✅
- Clear naming conventions
- Proper dependency ordering
- Platform-specific considerations
- Pre-build validation
- Error handling in binary creation
- Success/failure messaging
- Consistent cleanup patterns

**Improved:** 🔄
- ~~Error handling in scripts~~ → Added validation and success confirmation
- ~~Progress indicators for long-running tasks~~ → Added status messages
- Comprehensive testing strategy → Placeholder ready for implementation

**Still Missing:** ❌
- Environment-specific configurations
- Cross-platform process management 