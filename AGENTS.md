# Batchkit

TypeScript batching library monorepo (Bun workspaces). No external services or databases required.

## Cursor Cloud specific instructions

### Project structure

- `packages/core` — core `batchkit` library (zero runtime dependencies)
- `packages/devtools` — SolidJS-based DevTools panel (Vite build)
- `packages/devtools-react` — React wrapper for DevTools
- `packages/devtools-svelte` — Svelte wrapper for DevTools
- `apps/www` — Astro documentation site with interactive playground

### Key commands (all run from repo root)

| Task | Command |
|------|---------|
| Install deps | `bun install` |
| Lint | `bun run lint` |
| Fix lint | `bun run lint:fix` |
| Test | `bun test` |
| Build all | `bun run build` |
| Dev server (docs) | `bun run dev` |

### Caveats

- **Build order matters**: `bun run build` already handles the correct dependency order: core → devtools → devtools-react/svelte → www.
- **Astro content sync**: After fresh install, run `bun astro sync` in `apps/www` (or restart the dev server) if docs subpages return 404. The dev server must be restarted after the first sync for content routes to resolve.
- **Dev server port**: The Astro docs site runs on `http://localhost:4321/`.
- **Biome**: Linting and formatting use Biome (not ESLint/Prettier). Config is in `biome.json`.
- **ESM-only**: All packages use `"type": "module"` — no CommonJS.
- **Versions stay at 0.0.0**: Actual versions are injected from git tags at release time. See `packages/AGENTS.MD` for publishing rules.
