import { spawnSync } from 'node:child_process';
import { cloudflareBuildEnv } from './cloudflare-config.mjs';

const result = spawnSync('npm', ['run', 'build'], {
  env: cloudflareBuildEnv(), stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
