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
Use `yarn` (the repo includes `yarn.lock`).

- `yarn`: install dependencies.
- `yarn dev`: start Vite dev server with HMR.
- `yarn build`: run type-check and production build into `dist/`.
- `yarn build-only`: run only the Vite production build.
- `yarn preview`: serve the built app locally.
- `yarn lint`: run ESLint with `--fix` for `.vue/.ts/.js` files.
- `yarn format`: run Prettier on `src/`.

## Coding Style & Naming Conventions
- Formatting: 2-space indentation, semicolons, single quotes, trailing commas, max line width 100 (`.prettierrc.json`).
- Linting: ESLint with Vue 3 essential + TypeScript rules (`.eslintrc.cjs`).
- Vue SFCs and view/components: PascalCase file names (for example `BoardListView.vue`).
- Pinia stores and utility TS modules: concise lower-case names where established (for example `person.ts`).
- Prefer `@/` imports over long relative paths.

## Testing Guidelines
There is currently no test runner or `yarn test` script configured. For now:

- run `yarn lint` and `yarn build` before opening a PR.
- validate changed routes/views manually in `yarn dev`.

If adding tests, standardize on Vitest + Vue Test Utils and use `*.spec.ts` naming.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects (for example `Add PWA support`, `Modify breadcrumb UI`).

- Keep commit titles imperative and scoped to one change.
- PRs should include: summary, affected routes/components, verification steps, and screenshots for UI changes.
- Link related issues and note config changes (especially proxy/PWA behavior in `vite.config.ts`).
