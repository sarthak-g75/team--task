export default {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
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
