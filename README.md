# Sketchwave

A modern, real-time collaborative take on draw.io, built with Next.js. Several people can edit the same diagram at
once, see each other's cursors and selections live, and everything autosaves to Google Drive as a standard `.drawio`
file. The same files open in [diagrams.net](https://app.diagrams.net) and back without losing anything.

Running it costs $0: Vercel Hobby, the Firebase Spark plan, and Google's free APIs.

Try the editor without any setup at `/demo` (single user, saved in your browser).

## How it works

```
Google Drive (.drawio)  ◀── save leader: one editor's browser writes, debounced
        │ load / reseed                    ▲
        ▼                                  │ serialize
   Y.Doc (canonical model) ◀──▶ FirebaseYProvider ◀──▶ Realtime Database  rooms/{driveFileId}
        ▲ ▼  YGraphBinding                                updates · snapshot · presence · cursors · members · meta
   maxGraph (rendering + interaction)
```

- **Engine:** [`@maxgraph/core`](https://github.com/maxGraph/maxGraph), the TypeScript successor to draw.io's mxGraph.
- **Canonical model:** each diagram is a [Yjs](https://yjs.dev) CRDT document. Every cell keeps its raw draw.io style
  string and any attributes we don't understand, so diagrams.net files round-trip losslessly
  ([`src/lib/drawio`](src/lib/drawio)).
- **Realtime:** Yjs updates are appended to Firebase Realtime Database and compacted into snapshots. Presence and
  cursors use the same database, with throttling to stay well inside free-tier bandwidth
  ([`src/lib/collab`](src/lib/collab)).
- **Access control:** Drive sharing is the source of truth. `POST /api/rooms/:fileId/join` asks Drive whether you can
  edit or only view the file, then records that role. [Database rules](database.rules.json) only let members read a
  room and only editors write to it.
- **Saving:** the longest-connected editor is the save leader. Leadership moves automatically when they leave. The app
  also notices when the file was changed elsewhere (for example in diagrams.net) and offers to load that version.
- **Undo** only reverts your own edits, never a collaborator's.

## One-time setup (free)

1. **Firebase project** ([console.firebase.google.com](https://console.firebase.google.com)), on the Spark (free) plan:
   - Build → **Realtime Database** → Create database.
   - Build → **Authentication** → Sign-in method → enable **Google**.
   - Project settings → add a **Web app** and copy its config into `.env.local`.
   - Project settings → Service accounts → **Generate new private key** → put the JSON in `FIREBASE_SERVICE_ACCOUNT`.
   - Deploy the security rules: `npx firebase deploy --only database --project <your-project-id>`.
2. **Google Cloud** ([console.cloud.google.com](https://console.cloud.google.com)), same project as Firebase:
   - APIs & Services → enable the **Google Drive API** and the **Google Picker API**.
   - OAuth consent screen → External, add the scope `.../auth/drive.file`. It's a non-sensitive scope, so Google's
     app verification isn't required.
   - Credentials → **OAuth client ID** (Web application). Add your origins (`http://localhost:3000` and your Vercel
     URL) as authorized JavaScript origins. Copy the client ID and secret into `.env.local`.
3. `cp .env.example .env.local`, fill it in, set `SESSION_SECRET` (`openssl rand -base64 48`), then:

```bash
npm install
npm run dev
```

### Deploy to Vercel (Hobby)

Import the repo in Vercel, add every variable from `.env.example` under Project → Settings → Environment Variables,
and add the production URL to the OAuth client's authorized JavaScript origins.

## Free-tier limits

- **Firebase Spark:** 100 simultaneous connections, 1 GB stored, 10 GB/month downloaded. That's plenty for small
  teams: cursor updates are throttled to about 12 per second, and the update log is compacted every 200 updates.
- **Vercel Hobby:** for personal, non-commercial use.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm test` | Unit tests: `.drawio` codec, style strings, Yjs ↔ maxGraph binding convergence and undo |
| `npm run test:rules` | Realtime Database security rules against the Firebase emulator (needs Java) |
| `npm run test:e2e` | Multi-user Playwright tests against the Firebase emulators and an in-memory Drive stub |
| `npm run emulators` | Start the Auth and Database emulators for manual testing |

The E2E suite runs the app with `NEXT_PUBLIC_DRIVE_STUB=1` and `DRIVE_STUB=1`, which replace Google sign-in and Drive
with local fakes. Those stubs are refused in production builds.
