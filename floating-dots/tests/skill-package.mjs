// Catch incomplete runtime dependencies, stale packaged renderers, and writes
// over existing project files. Exercise a copy containing only the skill.
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'skills/floating-dots');
assert.ok(await stat(source).catch(() => null), 'floating-dots must provide a portable skill folder');
const sandbox = await mkdtemp(join(tmpdir(), 'floating-dots-skill-'));
const modules = ['floating-dots-engine.js', 'motion.js', 'noise-field.js'];

try {
  const skill = join(sandbox, '.agents/skills/floating-dots');
  await cp(source, skill, { recursive: true });
  const run = (destination, mode) => spawnSync('python3', [join(skill, 'scripts/materialize.py'),
    '--destination', destination, '--mode', mode], { encoding: 'utf8' });

  const runtime = join(sandbox, 'runtime with spaces');
  const result = run(runtime, 'runtime');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await readdir(runtime)).sort(),
    ['LICENSE', 'NOTICE.md', ...modules].sort(), 'runtime includes all three modules and notices');
  const standalone = join(sandbox, 'standalone');
  const preview = run(standalone, 'standalone');
  assert.equal(preview.status, 0, preview.stderr);
  for (const mode of [runtime, standalone]) {
    for (const name of modules) {
      assert.equal(await readFile(join(mode, name), 'utf8'), await readFile(join(root, name), 'utf8'),
        `${name} must match the approved demo`);
    }
    await writeFile(join(mode, 'keep.txt'), 'user-owned content');
    for (const outputMode of ['runtime', 'standalone']) {
      assert.notEqual(run(mode, outputMode).status, 0, 'existing destinations must be refused');
    }
    assert.equal(await readFile(join(mode, 'keep.txt'), 'utf8'), 'user-owned content');
  }

  const missingTarget = join(sandbox, 'must-not-create');
  const dangling = join(sandbox, 'dangling');
  await symlink(missingTarget, dangling);
  for (const mode of ['runtime', 'standalone']) {
    assert.notEqual(run(dangling, mode).status, 0, 'dangling symlinks must be refused');
  }
  assert.equal(await stat(missingTarget).catch(() => null), null, 'symlink target must remain absent');
  const invalid = join(sandbox, 'invalid');
  assert.notEqual(run(invalid, 'unknown').status, 0, 'invalid modes must fail');
  assert.equal(await stat(invalid).catch(() => null), null, 'invalid modes must not write');

  for (const name of ['google-sans-flex-latin.woff2', 'OFL.txt', 'SOURCES.txt']) {
    assert.deepEqual(await readFile(join(standalone, 'assets', name)), await readFile(join(root, 'assets', name)),
      'standalone preserves local font and attribution');
  }
  const pkg = JSON.parse(await readFile(join(standalone, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['test:skill'], undefined, 'standalone must not depend on the source skill');
  for (const command of ['check', 'test']) {
    const check = spawnSync('pnpm', [command], { cwd: standalone, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stdout + check.stderr);
  }
  console.log('PASS skill-package (isolated runtime/standalone, renderer parity, local assets, checks, non-overwrite)');
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
