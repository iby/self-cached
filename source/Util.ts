import * as core from '@actions/core';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export enum Input {
  Path = 'path',
  Key = 'key',
  Dir = 'dir',
}

export enum Output {
  CacheHit = 'cache-hit',
}

export enum State {
  CacheKey = 'CACHE_KEY',
  CacheDir = 'CACHE_DIR',
  CachePaths = 'CACHE_PATHS',
}

export function getDirInput(value: string | undefined): string {
  if (value) return value;
  if (process.env.SELF_CACHED_DIR) return process.env.SELF_CACHED_DIR;
  return path.join(os.homedir(), '.self-cached');
}

export async function getLocalPath(inputPath: string): Promise<{ path: string; name: string; exists: boolean }> {
  const expandedPath = inputPath.startsWith('~') ? path.join(os.homedir(), inputPath.slice(1)) : inputPath;
  const absolutePath = path.resolve(process.cwd(), expandedPath);
  let exists: boolean;
  try {
    await fs.lstat(absolutePath);
    exists = true;
  } catch {
    exists = false;
  }
  let name = inputPath.replace(/[^a-zA-Z0-9.-]/g, '_');
  if (name.length > 96) name = name.slice(0, 96) + '_' + crypto.createHash('sha256').update(absolutePath).digest('hex').slice(0, 16);
  return { path: absolutePath, name, exists };
}

/**
 * Restore cache entries for the given paths.
 */
export async function restore(inputPaths: string[], key: string, cacheDirPath: string): Promise<boolean> {
  const cacheBasePath = path.join(cacheDirPath, key);

  if (await fs.access(cacheBasePath).then(() => true).catch(() => false)) {
    core.info(`Cache found at ${cacheBasePath}, restoring…`);
  } else {
    core.info(`No cache found at: ${cacheBasePath}`);
    return false;
  }

  for (const inputPath of inputPaths) {
    const processedPath = await getLocalPath(inputPath);
    const cachePath = path.join(cacheBasePath, processedPath.name);
    if (!(await fs.access(cachePath).then(() => true).catch(() => false))) {
      core.debug(`Path "${inputPath}" not found in caches: skipping restore for this path…`);
      continue;
    }
    core.info(`Restoring ${inputPath} from: ${cachePath}`);
    await fs.mkdir(path.dirname(processedPath.path), { recursive: true }); // Ensure destination parent exists.
    // Remove the destination to ensure clean restore (also handles edge cases, like file vs. dir changes).
    await fs.rm(processedPath.path, { recursive: true, force: true }).catch();
    await fs.cp(cachePath, processedPath.path, { recursive: true, force: true });
  }

  return true;
}

/**
 * Store cache entries for the given paths.
 */
export async function store(paths: string[], key: string, cacheDirPath: string): Promise<void> {
  const cacheBasePath = path.join(cacheDirPath, key);

  if (await fs.access(cacheBasePath).then(() => true).catch(() => false)) {
    core.info(`Cache already exists at ${cacheBasePath}, skipping save.`);
    return;
  }

  core.info(`Creating cache directory: ${cacheBasePath}`);
  await fs.mkdir(cacheBasePath, { recursive: true });

  for (const inputPath of paths) {
    const processedPath = await getLocalPath(inputPath);
    const cachePath = path.join(cacheBasePath, processedPath.name);
    if (!processedPath.exists) {
      core.warning(`Path ${inputPath} does not exist or is not readable, skipping…`);
      continue;
    }
    core.info(`Copying ${inputPath} to: ${cachePath}`);
    await fs.cp(processedPath.path, cachePath, { recursive: true, force: true });
  }
  core.info(`Cache successfully stored to: ${cacheBasePath}`);
}
