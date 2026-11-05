# YuE2 Studio v2

SvelteKit + SQLite app. It is a local, single-user tool that runs YuE2 through `audiocpp_cli`.

## Run

```bash
cd app
npm install          # first time only
npm run dev          # http://localhost:5173, hot reload
# or production:
npm run build && npm start   # http://localhost:8000 (start.js loads ../.env)
```

Both commands must run with `app/` as the working directory. Paths resolve relative to the repo root, one level up.

## Tabs

- **Generate**: the composer (load a preset or a `song-prompts/*.md` file, section-tag buttons, advanced options), the live queue, and the latest 8 songs.
- **Gallery**: every song, with instant filters:
  - search
  - favorites, status, language, cot
  - flags, categories
  - genre, preset, BPM, length, date
  - sort and grid/list view
  - day timeline
  - bulk tag, flag and delete

  The filter state lives in the URL.
- **Styles**: Presets (CRUD, imported from `song-prompts/`), Compare (same lyrics and seed across N presets), and By style (songs grouped by genre or preset).
- **Guide**: what YuE2 can do, how to prompt it, and Suno tips with a Suno ↔ YuE2 mapping.

## Data

- `../data/studio.db` is the SQLite database: jobs, categories, flags, presets.
- `../output/*.wav` holds the audio. `../output/<id>.json` is a sidecar per job, in the same format the old app used. On startup, any sidecars not yet in the DB are imported, so the DB can be rebuilt by deleting it.
- `song-prompts/**/*.md` files that contain a `**Style prompt:**` block become presets on startup. Presets are matched by file path, so edits you make in the UI are not overwritten.
- Live updates go over Server-Sent Events at `/api/events`.

## Config

See the root [README](../README.md#configuration). Settings live in `../.env`, which is loaded by `src/lib/server/config.ts` (dev) and `start.js` (production).

## Checks

```bash
npm run check   # svelte-check
npm test        # vitest: detection, argv, metrics parsing, markdown import
```
