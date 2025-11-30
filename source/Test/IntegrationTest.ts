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
  const dirPaths = {
    cache: path.join(PRODUCT_PATH, 'test/cache'),
    project: path.join(PRODUCT_PATH, 'test/project'),
    stored: path.join(PRODUCT_PATH, 'test/stored'),
    restored: path.join(PRODUCT_PATH, 'test/restored'),
  };

  beforeAll(async () => {
    for (const dirPath of Object.values(dirPaths)) {
      await fs.rm(dirPath, { recursive: true, force: true });
    }
  });

  it('stores and restores cache for various file types and paths', async () => {
    const key = faker.string.alphanumeric(10);

    const projectPaths = {
      relative: await generateFile(dirPaths.project, faker.datatype.boolean()),
      absolute: await generateFile(dirPaths.project, faker.datatype.boolean()),
      tilde: await generateFile(dirPaths.project, faker.datatype.boolean()),
    };

    const inputPaths = {
      relative: path.relative(process.cwd(), projectPaths.relative),
      absolute: projectPaths.absolute,
      tilde: `~/${path.relative(os.homedir(), projectPaths.tilde)}`,
    };

    // Store and move the project directory to a different location.
    await store(Object.values(inputPaths), key, dirPaths.cache);
    await fs.rename(dirPaths.project, dirPaths.stored);

    // Verify that all files exist in the cache.
    for (const inputPath of Object.values(inputPaths)) {
      await fs.lstat(path.join(dirPaths.cache, key, (await getLocalPath(inputPath)).name));
    }

    // Restore and move the project directory to a different location.
    expect(await restore(Object.values(inputPaths), key, dirPaths.cache)).toBe(true);
    await fs.rename(dirPaths.project, dirPaths.restored);

    // Get all stored and restored files.
    const storedFilePaths = (await glob(path.join(dirPaths.stored, '/**/*'))).sort();
    const restoredFilePaths = (await glob(path.join(dirPaths.restored, '/**/*'))).sort();

    // Verify that all files are restored correctly.
    expect(storedFilePaths.map(p => path.relative(p, dirPaths.stored))).toEqual(restoredFilePaths.map(p => path.relative(p, dirPaths.restored)));
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
