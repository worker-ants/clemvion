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
  // Exit as soon as the run finishes even if a handle is still open. Nest
  // TestingModule/app, TypeORM pools, Redis/BullMQ clients or stray timers
  // occasionally outlive teardown and trigger "Jest did not exit one second
  // after the test run has completed", hanging the process indefinitely even
  // though every test passed. forceExit turns that hang into a clean ~1s exit.
  // It masks (does not fix) the leak — run `npm test -- --detectOpenHandles`
  // to locate the source and close it in afterAll. The run-test.sh watchdog is
  // the outer backstop if a test ever hangs *during* execution rather than at
  // teardown.
  forceExit: true,
};

export default config;
