import { faker } from '@faker-js/faker';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCompressInput, getDirInput, getLocalPath, restore, store } from '../Util';

vi.mock('@actions/core'); // Silences actions logging / output.
vi.mock('fs/promises'); // Don't do real filesystem operations.
vi.mock('node:child_process');

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe('getDirInput', () => {
  it('can return input value when only $SELF_CACHED_DIR is set', () => {
    vi.stubEnv('SELF_CACHED_DIR', 'foo');
    vi.stubEnv('RUNNER_TOOL_CACHE', undefined);
    expect(getDirInput('baz')).toBe('baz');
    expect(getDirInput(undefined)).toBe('foo');
  });

  it('can return input value when only $RUNNER_TOOL_CACHE is set', () => {
    vi.stubEnv('SELF_CACHED_DIR', undefined);
    vi.stubEnv('RUNNER_TOOL_CACHE', 'foo');
    expect(getDirInput('baz')).toBe('baz');
    expect(getDirInput(undefined)).toBe('foo');
  });

  it('can return input value when both $SELF_CACHED_DIR and $RUNNER_TOOL_CACHE are set', () => {
    vi.stubEnv('SELF_CACHED_DIR', 'foo');
    vi.stubEnv('RUNNER_TOOL_CACHE', 'bar');
    expect(getDirInput('baz')).toBe('baz');
    expect(getDirInput(undefined)).toBe('foo');
  });

  it("can't return input value when neither $SELF_CACHED_DIR or $RUNNER_TOOL_CACHE are not set", () => {
    vi.stubEnv('SELF_CACHED_DIR', undefined);
    vi.stubEnv('RUNNER_TOOL_CACHE', undefined);
    expect(getDirInput('baz')).toBe('baz');
    expect(getDirInput(undefined)).toBe(undefined);
  });
});

describe('getCompressInput', () => {
  it('can return input value when $SELF_CACHED_COMPRESS is set', () => {
    vi.stubEnv('SELF_CACHED_COMPRESS', 'true');
    expect(getCompressInput(undefined)).toBe(true);
    expect(getCompressInput('')).toBe(true);
    expect(getCompressInput('true')).toBe(true);
    expect(getCompressInput('false')).toBe(false);
    expect(getCompressInput('foo')).toBe(false);
    vi.stubEnv('SELF_CACHED_COMPRESS', 'false');
    expect(getCompressInput(undefined)).toBe(false);
    expect(getCompressInput('')).toBe(false);
    expect(getCompressInput('true')).toBe(true);
    expect(getCompressInput('false')).toBe(false);
    expect(getCompressInput('foo')).toBe(false);
  });

  it('can return input value when $SELF_CACHED_COMPRESS is not set', () => {
    vi.stubEnv('SELF_CACHED_COMPRESS', undefined);
    expect(getCompressInput(undefined)).toBe(true);
    expect(getCompressInput('')).toBe(true);
    expect(getCompressInput('true')).toBe(true);
    expect(getCompressInput('false')).toBe(false);
    expect(getCompressInput('foo')).toBe(false);
  });
});

describe('getLocalPath', () => {
  it('can handle relative paths', async () => {
    vi.mocked(fs.lstat).mockResolvedValue({ exists: true } as any);
    expect(await getLocalPath('foo')).toEqual({ path: path.resolve(process.cwd(), 'foo'), name: 'foo', exists: true });
    expect(await getLocalPath('./foo')).toEqual({ path: path.resolve(process.cwd(), 'foo/'), name: '._foo', exists: true });
    expect(await getLocalPath('foo/.')).toEqual({ path: path.resolve(process.cwd(), 'foo/'), name: 'foo_.', exists: true });
  });

  it('can handle absolute paths', async () => {
    vi.mocked(fs.lstat).mockResolvedValue({ exists: true } as any);
    expect(await getLocalPath('/foo')).toEqual({ path: '/foo', name: '_foo', exists: true });
    expect(await getLocalPath('/foo/')).toEqual({ path: '/foo', name: '_foo_', exists: true });
    expect(await getLocalPath('/foo/.')).toEqual({ path: '/foo', name: '_foo_.', exists: true });
  });

  it('can handle ~tilde paths', async () => {
    vi.mocked(fs.lstat).mockResolvedValue({ exists: true } as any);
    expect(await getLocalPath('~/foo')).toEqual({ path: path.resolve(os.homedir(), 'foo'), name: '__foo', exists: true });
    expect(await getLocalPath('~/foo/')).toEqual({ path: path.resolve(os.homedir(), 'foo'), name: '__foo_', exists: true });
    expect(await getLocalPath('~/foo/.')).toEqual({ path: path.resolve(os.homedir(), 'foo'), name: '__foo_.', exists: true });
  });

  it('can handle non-existent paths', async () => {
    vi.mocked(fs.lstat).mockRejectedValue(new Error('ENOENT'));
    expect(await getLocalPath('/foo')).toEqual({
      path: '/foo',
      name: '_foo',
      exists: false,
    });
  });
});

describe('restore', () => {
  it('can restore uncompressed cache if it exists', async () => {
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.lstat).mockResolvedValue({ isDirectory: () => false } as any);
    const result = await restore(['foo', '~/bar', '/baz'], 'abc', '/tmp/cache', false);
    expect(result).toBe(true);
    expect(fs.rm).toBeCalledTimes(3);
    expect(fs.rm).toBeCalledWith(path.join(process.cwd(), 'foo'), { recursive: true, force: true });
    expect(fs.rm).toBeCalledWith(path.join(os.homedir(), 'bar'), { recursive: true, force: true });
    expect(fs.rm).toBeCalledWith('/baz', { recursive: true, force: true });
    expect(fs.cp).toBeCalledTimes(3);
    expect(fs.cp).toBeCalledWith('/tmp/cache/abc/foo', path.join(process.cwd(), 'foo'), { recursive: true });
    expect(fs.cp).toBeCalledWith('/tmp/cache/abc/__bar', path.join(os.homedir(), 'bar'), { recursive: true });
    expect(fs.cp).toBeCalledWith('/tmp/cache/abc/_baz', '/baz', { recursive: true });
  });

  it('can restore compressed cache if it exists', async () => {
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.lstat).mockResolvedValue({ isDirectory: () => false } as any);
    const result = await restore(['foo', '~/bar', '/baz'], 'abc', '/tmp/cache', true);
    expect(result).toBe(true);
    expect(fs.rm).toBeCalledTimes(3);
    expect(fs.cp).not.toBeCalled();
    expect(execFileSync).toBeCalledTimes(3);
    expect(execFileSync).toBeCalledWith('tar', ['-xf', '/tmp/cache/abc/foo.tar', '-C', process.cwd()]);
    expect(execFileSync).toBeCalledWith('tar', ['-xf', '/tmp/cache/abc/__bar.tar', '-C', os.homedir()]);
    expect(execFileSync).toBeCalledWith('tar', ['-xf', '/tmp/cache/abc/_baz.tar', '-C', '/']);
  });

  it("can't restore cache if it doesn't exist", async () => {
    vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
    const result = await restore(['foo'], 'abc', '/tmp/cache', faker.datatype.boolean());
    expect(result).toBe(false);
    expect(fs.rm).not.toBeCalled();
    expect(fs.cp).not.toBeCalled();
  });
});

describe('store', () => {
  it("can store uncompressed cache if it doesn't exist", async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(fs.lstat).mockResolvedValue({ isDirectory: () => false } as any);
    await store(['foo', '~/bar', '/baz'], 'abc', '/tmp/cache', false);
    expect(fs.mkdir).toBeCalledTimes(1);
    expect(fs.mkdir).toBeCalledWith('/tmp/cache/abc', { recursive: true });
    expect(fs.cp).toBeCalledTimes(3);
    expect(fs.cp).toBeCalledWith(path.join(process.cwd(), 'foo'), '/tmp/cache/abc/foo', { recursive: true });
    expect(fs.cp).toBeCalledWith(path.join(os.homedir(), 'bar'), '/tmp/cache/abc/__bar', { recursive: true });
    expect(fs.cp).toBeCalledWith('/baz', '/tmp/cache/abc/_baz', { recursive: true });
  });

  it("can store compressed cache if it doesn't exist", async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(fs.lstat).mockResolvedValue({ isDirectory: () => false } as any);
    await store(['foo', '~/bar', '/baz'], 'abc', '/tmp/cache', true);
    expect(fs.mkdir).toBeCalledTimes(1);
    expect(fs.mkdir).toBeCalledWith('/tmp/cache/abc', { recursive: true });
    expect(execFileSync).toBeCalledTimes(3);
    expect(execFileSync).toBeCalledWith('tar', ['-cf', '/tmp/cache/abc/foo.tar', '-C', process.cwd(), 'foo']);
    expect(execFileSync).toBeCalledWith('tar', ['-cf', '/tmp/cache/abc/__bar.tar', '-C', os.homedir(), 'bar']);
    expect(execFileSync).toBeCalledWith('tar', ['-cf', '/tmp/cache/abc/_baz.tar', '-C', '/', 'baz']);
  });

  it("can't store cache if it already exists", async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    await store(['foo'], 'abc', '/tmp/cache', faker.datatype.boolean());
    expect(fs.mkdir).not.toBeCalled();
    expect(fs.cp).not.toBeCalled();
  });
});
