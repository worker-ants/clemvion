// Fixture anchor for `eslint-unicorn-peer.spec.ts`.
//
// `ESLint.lintText` (typescript-eslint `projectService`) rejects a `filePath` that isn't part of
// the backend tsconfig program ("was not found by the project service") — the path must exist on
// disk and fall under `tsconfig.json`'s default include. This file's real content is irrelevant:
// the spec always supplies its own text via `lintText`'s second argument, so what's linted is
// never what's written here.
export {};
