import { faker } from '@faker-js/faker';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { getLocalPath, restore, store } from '../Util';
import { generateFile, PRODUCT_PATH } from './Helper';

// Silences actions logging / output.
vi.mock('@actions/core');

describe('integration', () => {
  const testDirPath = path.join(PRODUCT_PATH, 'test/integration');

  beforeAll(async () => {
    await fs.rm(testDirPath, { recursive: true, force: true });
  });

  it.each([['compressed'], ['uncompressed']])('can store and restore %s cache', async (mode) => {
    const cacheDirPath = path.join(testDirPath, 'cache');
    const projectDirPath = path.join(testDirPath, 'project');
    const storedDirPath = path.join(testDirPath, `stored-${mode}`);
    const restoredDirPath = path.join(testDirPath, `restored-${mode}`);

    const projectPaths = {
      relative: await generateFile(projectDirPath, faker.datatype.boolean()),
      absolute: await generateFile(projectDirPath, faker.datatype.boolean()),
      tilde: await generateFile(projectDirPath, faker.datatype.boolean()),
    };

    const inputPaths = {
      relative: path.relative(process.cwd(), projectPaths.relative),
      absolute: projectPaths.absolute,
      tilde: `~/${path.relative(os.homedir(), projectPaths.tilde)}`,
    };

    const key = `${mode}-${faker.string.alphanumeric(4)}`;
    const compress = mode === 'compressed';

    // Store and move the project directory to a different location.
    await store(Object.values(inputPaths), key, cacheDirPath, compress);
    // A quick validation storing can work on the same path multiple times.
    await store(Object.values(inputPaths), key, cacheDirPath, compress);
    await fs.rename(projectDirPath, storedDirPath);

    // Verify that all files exist in the cache.
    for (const inputPath of Object.values(inputPaths)) {
      await fs.lstat(path.join(cacheDirPath, key, `${(await getLocalPath(inputPath)).name}${compress ? '.tar' : ''}`));
    }

    // Restore and move the project directory to a different location.
    expect(await restore(Object.values(inputPaths), key, cacheDirPath, compress)).toBe(true);
    // A quick validation restoring can work on the same path multiple times.
    expect(await restore(Object.values(inputPaths), key, cacheDirPath, compress)).toBe(true);
    await fs.rename(projectDirPath, restoredDirPath);

    // Get all stored and restored files.
    const storedFilePaths = (await glob(path.join(storedDirPath, '/**/*'))).sort();
    const restoredFilePaths = (await glob(path.join(restoredDirPath, '/**/*'))).sort();

    // Verify that all files are restored correctly.
    expect(storedFilePaths.map(p => path.relative(p, storedDirPath))).toEqual(restoredFilePaths.map(p => path.relative(p, restoredDirPath)));
    for (const [storedFilePath, restoredFilePath] of storedFilePaths.map((v, i) => [v, restoredFilePaths[i]])) {
      const storedStat = await fs.lstat(storedFilePath);
      const restoredStat = await fs.lstat(restoredFilePath);
      expect(storedStat.size).toBe(restoredStat.size);
      expect(storedStat.mode).toBe(restoredStat.mode);
      expect(storedStat.isFile()).toBe(restoredStat.isFile());
      expect(storedStat.isDirectory()).toBe(restoredStat.isDirectory());
      expect(storedStat.isSymbolicLink()).toBe(restoredStat.isSymbolicLink());
    }
  });
});
