import { faker } from '@faker-js/faker';
import fs from 'node:fs/promises';
import path from 'node:path';

export const ROOT_PATH = path.normalize(path.join(__dirname, '../..'));
export const PRODUCT_PATH = path.join(ROOT_PATH, 'product');
export const SOURCE_PATH = path.join(ROOT_PATH, 'source');
export const TEST_PATH = path.join(ROOT_PATH, 'test');

/**
 * Generates either a single file or a dir with files at the specified base path and return the path to the file.
 */
export async function generateFile(basePath: string, dir: boolean): Promise<string> {
  await fs.mkdir(basePath, { recursive: true });
  // Ensure the "top" path doesn't exist yet.
  let filePath: string;
  do filePath = path.join(basePath, dir ? faker.hacker.noun() : faker.system.fileName());
  while (await fs.lstat(filePath).then(() => true).catch(() => false));
  // For dirs, generate some files inside.
  if (dir) {
    for (let i = 0, n = faker.number.int({ min: 25, max: 75 }); i < n; i++) {
      const subPath = path.join(filePath, ...Array.from({ length: faker.number.int({ min: 0, max: 3 }) }, faker.hacker.noun), faker.system.fileName());
      // This may fail if the file with the same name already exists – just skip it…
      if (await fs.mkdir(path.dirname(subPath), { recursive: true }).then(() => true).catch(() => false)) {
        await fs.writeFile(subPath, faker.string.alphanumeric({ length: { min: 0, max: 250 } }));
      }
    }
  } else {
    await fs.writeFile(filePath, faker.string.alphanumeric({ length: { min: 0, max: 250 } }));
  }
  return filePath;
}
