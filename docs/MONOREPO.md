# Logos Notes Exporter - Monorepo Setup and Verification

### PNPM Workspace Configuration

```yaml
# pnpm-workspace.yaml ✅
packages:
  - packages/*

onlyBuiltDependencies:
  - '@tailwindcss/oxide'
  - better-sqlite3
  - bun
  - electron
  - electron-winstaller
  - lzma-native
  - unrs-resolver
```

### Package Manager Configuration

- Root package.json correctly specifies `"packageManager": "pnpm@10.13.1"`
- All packages have proper `"type": "module"` where needed
- Native dependencies handled via `onlyBuiltDependencies` configuration

### TypeScript Project References

- Root tsconfig.json configured with composite project references
- Each package extends base configuration and includes proper references
- Core package builds to TypeScript declarations for other packages

### Electron Webpack Setup

- Proper TypeScript webpack configurations
- Correct handling of native modules (better-sqlite3)
- Tailwind CSS 4.1.11 integration working correctly

### Monorepo Scripts

- Build scripts properly filter packages using `pnpm --filter`
- Development scripts correctly configured
- Clean and reinstall scripts handle all artifacts

## 📋 Fresh Setup Instructions

### Prerequisites

- **Node.js** 22.14.0 or higher (tested with 22.14.0)
- **PNPM** 10.13.1 or higher
- **Bun** 1.2.13 or higher (for CLI package)

### Step-by-Step Setup After Cloning from GitHub

#### 1. Clone and Navigate

```bash
git clone https://github.com/agape-apps/logos-notes-exporter.git
cd logos-notes-exporter
```

#### 2. Install PNPM and verify (if not already installed)

https://pnpm.io/installation

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
pnpm --version
```

#### 3. Clean Previous Installations

```bash
# Remove any existing node_modules and lock files
rm pnpm-lock.yaml
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf packages/*/dist
rm -rf packages/*/.webpack 
rm -rf packages/*/tsconfig.tsbuildinfo
```

#### 4. Install Dependencies

```bash
# Install all dependencies across the monorepo
pnpm install

# This will:
# - Install root dependencies
# - Install dependencies for all workspace packages
# - Link workspace packages together
# - Build necessary native modules via onlyBuiltDependencies
```

#### 5. Build Core Package First

```bash
# Build the core library (required by other packages)
pnpm run build:core
```

#### Do 3. 4. and 5. ALL IN ONE STEP

```bash
pnpm reinstall
```

#### 6. Verify Installation

**Test CLI Package:**

```bash
# Navigate to CLI package and test
cd packages/cli
pnpm run dev --help
cd ../..
```

**Test Electron Package:**

```bash
# Navigate to Electron package and test
cd packages/electron
pnpm start
```

#### 7. Development Workflow

**Start Electron App:**

```bash
# From root directory
pnpm start
# or
pnpm run dev:electron
```

**Test CLI App:**

```bash
# From root directory
pnpm run test:cli
# or
pnpm run dev:cli
```

**Build All Packages:**

```bash
# From root directory
pnpm run build
```

**Clean Build Artifacts:**

```bash
# From root directory
pnpm run clean
```

### Troubleshooting

#### If PNPM Install Fails:

```bash
# Clear PNPM cache
pnpm store prune

# Remove lock file and reinstall
rm pnpm-lock.yaml
pnpm install
```

#### If Electron App Won't Start:

```bash
# Rebuild native modules
cd packages/electron
pnpm run rebuild
```

#### If Better-SQLite3 Issues:

```bash
# Force rebuild of native modules
cd packages/electron
npx electron-rebuild
```

#### If TypeScript Build Errors:

```bash
# Clean TypeScript build cache
rm -rf packages/*/dist
rm -rf packages/*/tsconfig.tsbuildinfo
pnpm run build:core
```

#### For lint testing

```sh
# TypeScript compilation with project references
npx tsc --build

# TypeScript compilation with verbose output
npx tsc --build --verbose

# ESLint (now shows project references working)
pnpm run lint

# Individual package operations still work
pnpm run lint:core
pnpm run build:core
```

### Development Environment Verification

After setup, verify everything works:

1. **Core Package**: `pnpm run build:core` should complete without errors
2. **CLI Package**: `cd packages/cli && pnpm run dev --help` should show help text
3. **Electron Package**: `cd packages/electron && pnpm start` should open the app

### Package Dependencies Summary

**Root Level:**

- TypeScript 5.8.3
- Better-SQLite3 12.2.0 (for native module handling)
- ESLint 9.31.0 with TypeScript support

**Core Package (@logos-notes-exporter/core):**

- Bun runtime 1.0.0+
- fast-xml-parser 5.2.5
- YAML parser 2.8.0
- TypeScript 5.8.3

**CLI Package (@logos-notes-exporter/cli):**

- Depends on @logos-notes-exporter/core (workspace:*)
- Bun runtime 1.0.0+
- Binary compilation targets for multiple platforms

**Electron Package (@logos-notes-exporter/electron):**

- Depends on @logos-notes-exporter/core (workspace:*)
- Electron 37.2.1
- React 18.3.1
- Tailwind CSS 4.1.11
- Radix UI components (checkbox, dialog, progress, select, slot, switch, tooltip)
- Better-SQLite3 12.2.0
- Zustand 5.0.6 for state management
- Next-themes 0.4.6 for theme management
- Lucide-react 0.525.0 for icons
- Class-variance-authority 0.7.1 and clsx 2.1.1 for styling
- Sonner 2.0.6 for toast notifications

### TypeScript Configuration

- **Root tsconfig.json**: Configured with project references to all packages
- **Core Package**: Builds TypeScript declarations, composite project
- **CLI Package**: References core package, uses Bun types
- **Electron Package**: References core package, includes React JSX support, path aliases configured

### Native Dependencies Handling

The `onlyBuiltDependencies` configuration in `pnpm-workspace.yaml` ensures that native modules are properly built only when needed:

- `better-sqlite3`: Database access
- `electron`: Desktop application framework
- `bun`: JavaScript runtime for CLI
- `@tailwindcss/oxide`: CSS processing

### Scripts Reference

**Root Package Scripts:**
- `pnpm run build`: Build all packages in correct order
- `pnpm run build:core`: Build core package only
- `pnpm run build:cli`: Build CLI package only
- `pnpm run build:electron`: Build Electron package only
- `pnpm start`: Start Electron app (alias for dev:electron)
- `pnpm run dev:electron`: Start Electron app in development mode
- `pnpm run test:electron`: Test Electron app
- `pnpm run dev:cli`: Run CLI in development mode
- `pnpm run test:cli`: Test CLI app
- `pnpm run lint`: Lint all packages
- `pnpm run clean`: Clean all build artifacts and dependencies
- `pnpm reinstall`: Complete clean reinstall and core build

### Notes

- The monorepo uses **PNPM workspaces** for dependency management
- **Bun** is used as the runtime for CLI operations (faster SQLite operations)
- **Node.js** is used for Electron app
- **TypeScript 5.8.3** is used throughout with strict typing and project references
- **Native modules** (better-sqlite3) are properly handled in Electron packaging via onlyBuiltDependencies
- **Workspace dependencies** use `workspace:*` protocol for inter-package linking

