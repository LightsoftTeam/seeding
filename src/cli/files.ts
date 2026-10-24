import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import type { GeneratedFile } from './core.js';
import { GeneratedFileExistsError, GeneratedFileWriteError } from './errors.js';

/** Create parent directories and exclusively create a file; never overwrite. */
export async function writeGeneratedFile(
  file: GeneratedFile,
  workingDirectory: string,
): Promise<string> {
  const path = resolve(workingDirectory, file.path);
  await createParentDirectory(path, file.path);
  try {
    await writeFile(path, file.content, { encoding: 'utf8', flag: 'wx' });
    return relative(await realpath(workingDirectory), await realpath(path));
  } catch (error) {
    if (isExistingFileError(error)) {
      throw new GeneratedFileExistsError(file.path);
    }
    throw new GeneratedFileWriteError(file.path, error);
  }
}

async function createParentDirectory(
  path: string,
  requestedPath: string,
): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true });
  } catch (error) {
    throw new GeneratedFileWriteError(requestedPath, error);
  }
}

function isExistingFileError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'EEXIST'
  );
}
