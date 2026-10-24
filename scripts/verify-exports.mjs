// Loads every public entry point through the package self-reference,
// once with require() and once with import(), so a broken exports map fails CI.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const METADATA_ENTRY = './package.json';

const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const require = createRequire(import.meta.url);
const specifiers = Object.keys(manifest.exports)
  .filter((entry) => entry !== METADATA_ENTRY)
  .map((entry) => entry.replace(/^\./, manifest.name));

for (const specifier of specifiers) {
  const required = require(specifier);
  const imported = await import(specifier);
  assertHasExports(specifier, 'require', required);
  assertHasExports(specifier, 'import', imported);
  console.log(`ok ${specifier}`);
}

function assertHasExports(specifier, loader, moduleNamespace) {
  if (Object.keys(moduleNamespace).length > 0) {
    return;
  }

  throw new Error(`${loader}('${specifier}') resolved to an empty module`);
}
