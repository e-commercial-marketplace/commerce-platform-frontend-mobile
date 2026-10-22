/**
 * Jest configuration for the Expo project.
 * `jest-expo` supplies the Babel transform, transformIgnorePatterns and
 * React Native module mocks, so only the setup file needs to be wired up.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
};
