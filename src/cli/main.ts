#!/usr/bin/env node
import { runCli } from './core.js';
import { writeGeneratedFile } from './files.js';

const ARGUMENT_OFFSET = 2;
const result = await runCli(process.argv.slice(ARGUMENT_OFFSET), (file) =>
  writeGeneratedFile(file, process.cwd()),
);

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
