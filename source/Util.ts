import * as core from '@actions/core';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export enum Input {
  Path = 'path',
  Key = 'key',
  Dir = 'dir',
  Compress = 'compress',
}

export enum Output {
  CacheHit = 'cache-hit',
}

export enum State {
  CacheKey = 'CACHE_KEY',
  CacheDir = 'CACHE_DIR',
  CachePaths = 'CACHE_PATHS',
  CacheCompress = 'CACHE_COMPRESS',
}

export function getDirInput(value: string | undefined): string | undefined {
  if (value) return value;
  else if (process.env.SELF_CACHED_DIR) return process.env.SELF_CACHED_DIR;
  else return process.env.RUNNER_TOOL_CACHE;
}

export function getCompressInput(value: string | undefined): boolean {
  if (value) return value == 'true';
  else if (process.env.SELF_CACHED_COMPRESS) return process.env.SELF_CACHED_COMPRESS == 'true';
  else return true;
}

export async function getLocalPath(inputPath: string): Promise<{
  input: string; // The original path to the input file.
  resolved: string; // The full path (expanded ~ and relative to cwd) to the input file.
  cacheName: string; // The cache name to use for the path.
  isAccessible: boolean; // Whether the path exists and is accessible.
}> {
  const expandedPath = inputPath.startsWith('~') ? path.join(os.homedir(), inputPath.slice(1)) : inputPath;
  const resolvedPath = path.resolve(process.cwd(), expandedPath);
  const isAccessible = await fs.access(resolvedPath, fs.constants.R_OK | fs.constants.W_OK).then(() => true).catch(() => false);
  let cacheName = inputPath.replace(/[^a-zA-Z0-9.-]/g, '_');
  if (cacheName.length > 96) cacheName = cacheName.slice(0, 96) + '_' + crypto.createHash('sha256').update(resolvedPath).digest('hex').slice(0, 16);
  return { input: inputPath, resolved: resolvedPath, cacheName, isAccessible };
}

export async function getCachePath(dirPath: string, cacheName: string, archive: boolean): Promise<{
  resolved: string; // The full path to the cache file.
  isAccessible: boolean; // Whether the cache file exists and is accessible.
}> {
  const resolvedPath = path.join(dirPath, `${cacheName}${archive ? '.tar' : ''}`);
  const isAccessible = await fs.access(resolvedPath, fs.constants.R_OK | fs.constants.W_OK).then(() => true).catch(() => false);
  return { resolved: resolvedPath, isAccessible };
}

/**
 * Restore cache entries for the given paths.
 */
export async function restore(inputPaths: string[], key: string, cacheDirPath: string, compression: boolean): Promise<boolean> {
  if (!inputPaths.length) return true;
  const cacheBasePath = path.join(cacheDirPath, key);

  const paths = await Promise.all(inputPaths.map(async p => {
    const local = await getLocalPath(p);
    const cache = await getCachePath(cacheBasePath, local.cacheName, compression);
    return { local, cache };
  }));

  const missingCacheInputPaths = paths.filter(p => !p.cache.isAccessible).map(p => p.local.input);
  if (missingCacheInputPaths.length) {
    core.info(`Aborting restore: Caches are missing at "${cacheBasePath}" for inputs paths: "${missingCacheInputPaths.join('", "')}"`);
    return false;
  } else {
    core.info(`Caches found at ${cacheBasePath} for all input paths: "${inputPaths.join('", "')}"`);
  }

  const fns: (() => Promise<void>)[] = [];
  for (const [index, { local: localPath, cache: cachePath }] of paths.entries()) {
    const conflictingPath = paths.slice(0, index).find(p => p.local.cacheName === localPath.cacheName)?.local;

    if (conflictingPath) {
      core.warning(`Aborting restore: Cache name for "${localPath.input}" path conflicts with "${conflictingPath.input}".`);
      return false;
    }

    fns.push(async () => {
      core.info(`Creating input path directory: ${path.dirname(localPath.input)}`);
      await fs.mkdir(path.dirname(localPath.input), { recursive: true });
      core.info(`Restoring "${localPath.input}" from: ${cachePath.resolved}`);
      // Remove the destination to ensure clean restore (also handles edge cases, like file vs. dir changes).
      await fs.rm(localPath.resolved, { recursive: true, force: true }).catch();
      if (compression) {
        execFileSync('tar', ['-xf', cachePath.resolved, '-C', path.dirname(localPath.resolved)]);
      } else {
        await fs.cp(cachePath.resolved, localPath.resolved, { recursive: true });
      }
    });
  }

  await Promise.all(fns.map(fn => fn()));

  core.info(`Cache successfully restored from: ${cacheBasePath}`);
  return true;
}

/**
 * Store cache entries for the given paths.
 */
export async function store(inputPaths: string[], key: string, cacheDirPath: string, compression: boolean): Promise<boolean> {
  if (!inputPaths.length) return true;
  const cacheBasePath = path.join(cacheDirPath, key);

  const paths = await Promise.all(inputPaths.map(async p => {
    const local = await getLocalPath(p);
    const cache = await getCachePath(cacheBasePath, local.cacheName, compression);
    return { local, cache };
  }));

  if (paths.every(p => p.cache.isAccessible)) {
    core.info(`Aborting store: Cache already exists at "${cacheBasePath}" for all inputs: "${inputPaths.join('", "')}"`);
    return false;
  }

  const fns: (() => Promise<void>)[] = [];
  for (const [index, { local: localPath, cache: cachePath }] of paths.entries()) {
    const conflictingPath = paths.slice(0, index).find(p => p.local.cacheName === localPath.cacheName)?.local;

    if (!localPath.isAccessible) {
      core.warning(`Aborting store: File at "${localPath.input}" path doesn't exist or not accessible.`);
      return false;
    }

    if (conflictingPath) {
      core.warning(`Aborting store: Cache name for "${localPath.input}" path conflicts with "${conflictingPath.input}".`);
      return false;
    }

    fns.push(async () => {
      if (compression) {
        core.info(`Archiving ${localPath.input} to: ${cachePath.resolved}`);
        execFileSync('tar', ['-cf', cachePath.resolved, '-C', path.dirname(localPath.resolved), path.basename(localPath.resolved)]);
      } else {
        core.info(`Copying ${localPath.input} to: ${cachePath.resolved}`);
        await fs.cp(localPath.resolved, cachePath.resolved, { recursive: true });
      }
    });
  }

  core.info(`Creating cache directory: ${cacheBasePath}`);
  await fs.mkdir(cacheBasePath, { recursive: true });
  await Promise.all(fns.map(fn => fn()));

  core.info(`Cache successfully stored to: ${cacheBasePath}`);
  return true;
}
