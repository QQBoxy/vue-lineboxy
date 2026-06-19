# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vue 3 + Vite + TypeScript frontend app.

- `src/main.ts`: app bootstrap.
- `src/App.vue`: root shell.
- `src/views/`: route-level pages (`HomeView.vue`, `BoardView.vue`).
- `src/components/`: reusable UI components (`ModalView.vue`).
- `src/router/index.ts`: Vue Router setup.
- `src/stores/`: Pinia stores (for example `person.ts`).
- `src/assets/` and `public/`: static assets.
- `vite.config.ts`: alias (`@ -> src`), dev proxy, and PWA config.

## Build, Test, and Development Commands
Use `pnpm` (the repo includes `pnpm-lock.yaml`).

- `pnpm install`: install dependencies.
- `pnpm dev`: start Vite dev server with HMR.
- `pnpm build`: run type-check and production build into `dist/`.
- `pnpm build-only`: run only the Vite production build.
- `pnpm preview`: serve the built app locally.
- `pnpm lint`: run ESLint with `--fix` for `.vue/.ts/.js` files.
- `pnpm format`: run Prettier on `src/`.

## Coding Style & Naming Conventions
- Formatting: 2-space indentation, semicolons, single quotes, trailing commas, max line width 100 (`.prettierrc.json`).
- Linting: ESLint with Vue 3 essential + TypeScript rules (`.eslintrc.cjs`).
- Vue SFCs and view/components: PascalCase file names (for example `BoardListView.vue`).
- Pinia stores and utility TS modules: concise lower-case names where established (for example `person.ts`).
- Prefer `@/` imports over long relative paths.

## Testing Guidelines
There is currently no test runner or `pnpm test` script configured. For now:

- run `pnpm lint` and `pnpm build` before opening a PR.
- validate changed routes/views manually in `pnpm dev`.

If adding tests, standardize on Vitest + Vue Test Utils and use `*.spec.ts` naming.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects (for example `Add PWA support`, `Modify breadcrumb UI`).

- Keep commit titles imperative and scoped to one change.
- This is a personal project: commit directly to `main`; do not create feature branches unless explicitly requested.
- Do not push to GitHub automatically. Only push to `main` after the user explicitly says it is OK to push.
- Pull requests are not required for normal changes.
- When a PR is explicitly requested, include: summary, affected routes/components, verification steps, and screenshots for UI changes.
- Link related issues and note config changes when relevant (especially proxy/PWA behavior in `vite.config.ts`).
