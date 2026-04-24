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
  // ESM-only packages (uuid >=12, p-limit >=4, yocto-queue) must be transformed.
  // The optional `\.pnpm/[^/]+/node_modules/` prefix is a leftover from a prior
  // pnpm install — kept for forward-compat if anyone reintroduces pnpm locally,
  // though the project itself now standardizes on npm (see CLAUDE.md).
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:uuid|p-limit|yocto-queue)/)',
  ],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // Allow imports to omit `.js` suffix (NestJS pattern): resolves `./foo.js`
  // to the corresponding `.ts` source during tests.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

export default config;
