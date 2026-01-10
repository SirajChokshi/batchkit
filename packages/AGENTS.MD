# Publishing Rules

## Versioning
- Keep `version` at `0.0.0` in all package.json files
- Releases are published via git tags (e.g. `v0.3.2`)

## Workspace Dependencies
- `workspace:*` must ONLY appear in `devDependencies`
- For inter-package deps, use both:
  - `peerDependencies: { "package": "*" }` — published to npm
  - `devDependencies: { "package": "workspace:*" }` — local linking
- Bun does NOT auto-convert `workspace:*` on publish (unlike pnpm)

## Build Artifacts
- Never commit `.tsbuildinfo` files (causes stale incremental builds in CI)
- Never commit `dist/` folders
