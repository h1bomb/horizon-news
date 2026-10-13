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

## Cursor Cloud specific instructions

- Install with `pnpm install --frozen-lockfile` (Node 22, `pnpm-lock.yaml`). The committed `content/` store is enough to lint, test, build, and run the site.
- `pnpm dev` listens on port 3000. `/` redirects from the browser language to `/zh/` or `/en/`.
- `pnpm worker` sparse-clones `https://github.com/Thysrael/Horizon.git` and rewrites `content/`. It is not required to boot the dev server.
- `pnpm build` is a static export (`output: "export"`) into `out/`. In `next dev`, news URLs whose slugs are not ASCII return 500 because `output: "export"` requires every requested param to match `generateStaticParams()`, and the browser percent-encodes those slugs. Listing routes (`/zh/`, archive, day, about, `/en/`) work in dev. The same articles render from `out/` after a build.
