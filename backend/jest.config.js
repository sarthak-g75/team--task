export default {
  testEnvironment: 'node',
  // Source imports use explicit .js specifiers (ESM style); strip them so the
  // CommonJS test transform can resolve the .ts files.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // The app ships as ESM, but tests run under CommonJS via ts-jest — this avoids
  // the experimental VM-modules instability while exercising the real app code.
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts'],
};
