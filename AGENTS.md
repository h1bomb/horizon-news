<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Commands

- **Lint:** `pnpm lint`
- **Typecheck:** `pnpm typecheck`
- **Tests:** `pnpm test`
- **Build:** `pnpm build` (runs `prebuild` feed generation, then `next build` → `out/`)
- **Worker:** `pnpm worker` (regenerates `content/` from Horizon)
- **Dev:** `pnpm dev`
