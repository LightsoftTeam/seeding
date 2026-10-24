import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/peru/index.ts',
    'src/cosmos/index.ts',
    'src/testing/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  external: ['@faker-js/faker', '@azure/cosmos'],
});
