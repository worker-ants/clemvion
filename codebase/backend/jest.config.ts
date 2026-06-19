import type { Config } from 'jest';

/**
 * Backend Jest configuration.
 *
 * Extracted from package.json (commit history) so we can annotate the
 * transformIgnorePatterns regex — JSON does not allow comments and the
 * regex is non-obvious.
 */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // ESM-only packages must be transformed. uuid >=12, p-limit >=4, yocto-queue;
  // otplib >=13 rewrite ships ESM + pulls ESM-only @otplib/*, @scure/base,
  // @noble/hashes (totp.service uses otplib for 2FA).
  // The optional `\.pnpm/[^/]+/node_modules/` prefix is a leftover from a prior
  // pnpm install — kept for forward-compat if anyone reintroduces pnpm locally,
  // though the project itself now standardizes on npm (see CLAUDE.md).
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble)/)',
  ],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // Allow imports to omit `.js` suffix (NestJS pattern): resolves `./foo.js`
  // to the corresponding `.ts` source during tests.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // No forceExit: the unit suite exits on its own. The single open handle that
  // forceExit previously masked was a process-lifetime `CustomGC` libuv handle
  // from the native `@napi-rs/canvas` addon, which `pdf-parse` (via pdfjs-dist)
  // loaded at *import* time — pulled in transitively by knowledge-base parser
  // specs that never actually parse a PDF. `pdf.parser.ts` now `require`s
  // pdf-parse lazily on first parse, so the addon never loads during unit tests
  // and `npm test -- --detectOpenHandles` reports zero handles. If a future
  // change reintroduces a leak, that flag is the diagnostic; close the resource
  // in afterAll rather than re-adding forceExit. The run-test.sh watchdog
  // remains the backstop for a hang *during* execution.
  //
  // test/jest-e2e.json drops forceExit for the same reason (JSON can't carry
  // this note): e2e specs are black-box HTTP against a container — they own no
  // Nest app and no native addon, only a `pg` Client per spec, which every spec
  // that opens one now closes via `await db.end()` in afterAll (specs that issue
  // no DB query, e.g. health.e2e-spec, open no handle at all). detectOpenHandles
  // across all e2e suites reports zero handles, so don't re-add forceExit there
  // on a hang — find the spec that forgot db.end() instead.
};

export default config;
