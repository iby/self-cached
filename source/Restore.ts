import * as core from '@actions/core';
import { getCompressInput, getDirInput, Input, Output, restore, State } from './Util';

(async (): Promise<void> => {
  try {
    const paths = core.getInput(Input.Path, { required: true }).split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
    const key = core.getInput(Input.Key, { required: true });
    const dir = getDirInput(core.getInput(Input.Dir, { required: false }));
    const compress = getCompressInput(core.getInput(Input.Compress, { required: false }));

    if (!paths.length || !key || !dir) {
      core.info('Missing inputs, skipping cache restore.');
      return;
    }

    // Save state for the post step.
    core.saveState(State.CacheKey, key);
    core.saveState(State.CacheDir, dir);
    core.saveState(State.CachePaths, JSON.stringify(paths));
    core.saveState(State.CacheCompress, compress.toString());

    const isRestored = await restore(paths, key, dir, compress);
    core.setOutput(Output.CacheHit, isRestored.toString());

    if (isRestored) {
      core.info(`Cache restored from: ${dir}/${key}`);
    } else {
      core.info(`No cache found for key: ${key}`);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : `Unknown error occurred during restore: ${error}`);
  }
})();
