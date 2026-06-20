# AGENTS.md

## Project Shape
- The runnable app is in `ai-edu/`; the repo root mainly holds shared instructions and `scripts/`.
- Frontend: React 19 + Vite + Zustand. Backend: Express 5 + `better-sqlite3` by default.
- There is no workspace-level package manager config; run frontend and backend commands from their own package directories.

## Commands
- Frontend dev/build/lint from `ai-edu/`: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.
- Backend from `ai-edu/backend/`: `npm start` or `npm run dev`.
- Dev ports are fixed by config: Vite `5173`, backend `3001`; Vite proxies `/api` to `http://localhost:3001`.
- `scripts/build.sh` is interactive and assumes it is run from `ai-edu/`, not the repo root; prefer direct npm commands for automation.
- No test scripts are defined in either `package.json`; use `npm run lint` and `npm run build` as available frontend verification.

## Entry Points And Wiring
- `ai-edu/src/main.jsx` mounts `App.jsx`, but `App.jsx` delegates to `App.replacement.jsx`; edit `App.replacement.jsx` for live app behavior.
- `ai-edu/src/hooks/useScenarioEngine.ts` contains legacy code and ends by re-exporting `useScenarioEngine.replacement.ts`; edit the replacement file for guided-scenario behavior.
- Guided pedagogy is wired through `src/store/scenarioConfig.ts`, `src/store/pedagogyStore.js`, `src/hooks/useScenarioEngine.replacement.ts`, and `src/hooks/useTrainingInterceptor.js`.
- Lab components live in `src/labs/`; pure ML logic lives in `src/utils/` and should stay React-free.

## Backend Notes
- Backend env is loaded from `ai-edu/backend/.env`; use `.env.example` as the public reference and do not read or expose local `.env` secrets.
- SQLite data is created under `ai-edu/backend/data/ai_edu.db`; `db.js` creates tables at server startup.
- `DB_MODE` is declared as `sqlite` or `postgres`, but current `db.js` always opens SQLite.
- Production auth requires `JWT_SECRET`; development falls back to an insecure default.
- AI chat routes require `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` and call OpenRouter.

## Frontend Gotchas
- Feature-gated UI depends on `pedagogyStore.unlocks`; add or change unlock names in `scenarioConfig.ts` and the consuming component together.
- The `poisoned` neural-network dataset and lack of normalization are intentional for teaching gradient explosion; do not "fix" that unless the task explicitly asks.
- Most app-wide styling is in `src/App.css`; `src/index.css` is the Vite entry global stylesheet.

## Ignore Unless Asked
- `ai-edu/dist/` is build output.
- `ai-edu/.security-backup-*` contains backup copies, not active source.
