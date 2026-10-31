# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Lineweave: a real-time collaborative draw.io clone (Next.js App Router, React 19, `@maxgraph/core`, Yjs). Diagrams live in Google Drive as standard `.drawio` files and must round-trip losslessly with diagrams.net. See `README.md` for setup (Firebase + Google Cloud) and free-tier constraints.

`AGENTS.md` warns that this Next.js version (16.x) has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.

## Commands

```bash
npm run dev            # Next dev server (needs .env.local, see .env.example)
npm run build          # production build
npm run lint           # eslint
npm test               # vitest unit tests (tests/unit/**/*.test.ts, jsdom)
npx vitest run tests/unit/codec.test.ts          # single test file
npx vitest run -t "name fragment"                # single test by name
npm run test:rules     # RTDB security rules vs Firebase emulator (needs Java)
npm run test:e2e       # Playwright, multi-user; starts auth+database emulators
npx playwright test tests/e2e/schematics.spec.ts # needs emulators already running (npm run emulators)
```

- `/demo` runs the editor with no backend (single user, browser-local), which is the easiest way to exercise editor changes.
- E2E runs `next dev` on port 3100 with `NEXT_DIST_DIR=.next-e2e` and `NEXT_PUBLIC_DRIVE_STUB=1` / `DRIVE_STUB=1`, which swap Google sign-in and Drive for an in-memory fake (`src/lib/server/driveStub.ts`, `src/app/api/dev/drive/`). Stubs are refused in production builds.
- `scripts/gen-electrical-stencils.mjs` and `gen-lucide-icons.mjs` regenerate the checked-in generated files under `src/lib/graph/stencils/` and `palettes/`; don't hand-edit those outputs.

## Architecture

Data flow: **Drive `.drawio` ⇄ Y.Doc (canonical) ⇄ `YGraphBinding` ⇄ maxGraph (render/interaction)**, with the Y.Doc also synced through Firebase Realtime Database.

- `src/lib/drawio/`: codec for `.drawio` XML ⇄ Y.Doc (`codec.ts`, `ydoc.ts`), plus importers (Mermaid, CSV, VSDX) and style-string helpers. **Y is the source of truth**: every cell keeps its raw draw.io style string and unknown attributes, so nothing maxGraph doesn't model is lost. Preserve this when adding features: write to Y, don't rely on maxGraph state alone.
- `src/lib/collab/yGraphBinding.ts`: two-way sync between one page of the Y.Doc and a maxGraph model. Local edits are written to Y tagged with `origin`; remote edits and undo/redo are reconciled into the graph with an `applying` guard to avoid echo. Direct Y edits (paste, Edit Data/Style) use `importOrigin` so they're applied like remote changes but still tracked by the user's `Y.UndoManager`. Undo is per-user.
- `src/lib/collab/session.ts`: the `EditorSession` interface the editor consumes. Two implementations: `DemoSession` (local) and `DriveSession` (Drive + Firebase) in `src/components/sessions/`. Optional members (`presence`, `save`, `versions`, `comments`) are simply absent in demo mode, so UI must handle them being undefined.
- `src/lib/collab/`: `firebaseYProvider` appends Yjs updates to RTDB and compacts into snapshots; `firebasePresence` handles presence/cursors (throttled for bandwidth); `driveSaver` implements save-leader election (longest-connected editor writes to Drive, debounced) and external-change detection; `openRoom` ties it together.
- Access control: `POST /api/rooms/[fileId]/join` asks Drive whether the user can edit/view, then records the role under the room; `database.rules.json` enforces member-read / editor-write. Rules changes need `npm run test:rules`. Drive refresh tokens live in an encrypted cookie (`src/lib/server/googleAuth.ts`, `src/app/api/auth/*`); only the `drive.file` scope is used.
- `src/lib/server/roomRetention.ts` + `/api/cron/prune-rooms` (Vercel cron in `vercel.json`, auth via `CRON_SECRET`) delete rooms idle 30 days to stay under Spark's 1 GB; a deleted room reseeds from Drive on next open.
- `src/lib/graph/`: maxGraph setup and editor operations (`createGraph`, `actions`, `arrange`, `clipboard`, `export`, `layouts`, custom `shapes`, `wires`, `lineJumps`). `palettes/` defines shape libraries (core, extra, electrical, FRC, Lucide icons); `stencils/` registers draw.io's electrical stencils under diagrams.net's `mxgraph.electrical.*` shape names so files render identically in both editors.
- `src/components/editor/`: editor UI (`EditorShell` is the root; `Canvas`, format panel, dialogs, minimap, comments/versions). Routes: `/` landing, `/files` Drive browser, `/d/[fileId]` Drive editor, `/demo` local editor.
- `src/lib/store.ts`: tiny observable `Store<T>` used instead of a state library; React reads it via hooks in `components/editor/hooks.ts`.

Path alias `@/` → `src/`. Unit tests import from `@/`.
