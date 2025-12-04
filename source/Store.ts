import * as core from '@actions/core';
import { State, store } from './Util';

(async (): Promise<void> => {
  try {
    const paths = JSON.parse(core.getState(State.CachePaths) || '[]');
    const key = core.getState(State.CacheKey);
    const dir = core.getState(State.CacheDir);
    const compress = core.getState(State.CacheCompress) === 'true';

    if (!paths.length || !key || !dir) {
      core.info('Missing state inputs, skipping cache store.');
      return;
    }

    await store(paths, key, dir, compress);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : `Unknown error occurred during restore: ${error}`);
  }
})();
