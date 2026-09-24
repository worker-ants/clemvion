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
  // **Default on purpose — node_modules is never transformed.**
  //
  // This used to be a hand-maintained allowlist that fed ESM-only packages
  // (uuid, p-limit, yocto-queue, otplib, @otplib, @scure, @noble) through
  // ts-jest so they came out as CJS. Every package that went ESM had to be
  // appended by hand, and the list could only ever grow.
  //
  // Jest now loads them as ESM natively: `package.json` runs jest under
  // `node --experimental-vm-modules`, which exposes `vm.SourceTextModule` and
  // flips jest-runtime's `supportsSyncEvaluate` — the gate behind its
  // `require(ESM)` support. (The gate is the flag, NOT the Node version: CI was
  // already on Node 24.20 and still failed, because jest probes
  // `vm.SourceTextModule.prototype.hasAsyncGraph`, which only exists with the
  // flag. Jest's own error text points at the Node version and misleads.)
  //
  // **The two changes are a pair — reverting either one alone breaks the suite.**
  // Under vm-modules jest evaluates a `type: module` package as ESM, so if
  // ts-jest had already rewritten it to CJS the module body throws
  // `ReferenceError: exports is not defined` (measured with uuid@13).
  //
  // This also unblocks dependencies that CANNOT be downleveled at all —
  // `@nestjs/typeorm@12` uses `import.meta.url`, which has no CJS form.
  transformIgnorePatterns: ['/node_modules/'],
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
  // and `pnpm test -- --detectOpenHandles` reports zero handles. If a future
  // change reintroduces a leak, that flag is the diagnostic; close the resource
  // in afterAll rather than re-adding forceExit. The run-test.sh watchdog
  // remains the backstop for a hang *during* execution.
  //
  // test/jest-e2e.json drops forceExit for the same reason (JSON can't carry
  // this note): e2e specs are black-box HTTP against a container — they own no
  // Nest app and no native addon, only a `pg` Client per spec, which every spec
  // that opens one now closes via `await db.end()` in afterAll (specs that issue
  // no DB query, e.g. health.e2e-spec, open no handle at all). Specs that must
  // reproduce a window HTTP can't open (e.g. trigger-update-save-window) also open a
  // TypeORM DataSource and close it with `ds.destroy()` in the same afterAll; specs
  // that inspect BullMQ close their Queue there too. detectOpenHandles
  // across all e2e suites reports zero handles, so don't re-add forceExit there
  // on a hang — find the spec that forgot db.end() instead.
};

export default config;
