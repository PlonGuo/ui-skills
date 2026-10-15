import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = join(root, 'skills/tilting-photo-wall/scripts/materialize.py');
const sandbox = await mkdtemp(join(tmpdir(), 'photo-wall-skill-'));
const run = (destination, mode) => spawnSync('python3', [script, '--destination', destination, '--mode', mode], { encoding: 'utf8' });
let preview;

try {
  const runtime = join(sandbox, 'runtime with spaces');
  const result = run(runtime, 'runtime');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await readdir(runtime)).sort(), ['LICENSE', 'NOTICE.md', 'photo-wall-engine.js']);
  assert.equal(await readFile(join(runtime, 'photo-wall-engine.js'), 'utf8'),
    await readFile(join(root, 'photo-wall-engine.js'), 'utf8'),
    'packaged runtime must preserve the approved renderer and scroll direction');

  await writeFile(join(runtime, 'keep.txt'), 'user-owned content');
  assert.notEqual(run(runtime, 'standalone').status, 0, 'existing destinations are refused');
  assert.equal(await readFile(join(runtime, 'keep.txt'), 'utf8'), 'user-owned content');

  const dangling = join(sandbox, 'dangling');
  const missingTarget = join(sandbox, 'must-not-create');
  await symlink(missingTarget, dangling);
  assert.notEqual(run(dangling, 'runtime').status, 0, 'dangling symlinks are not followed');
  assert.notEqual(run(join(sandbox, 'invalid'), 'unknown').status, 0, 'invalid modes fail');

  const standalone = join(sandbox, 'standalone');
  const copied = run(standalone, 'standalone');
  assert.equal(copied.status, 0, copied.stderr);
  for (const command of [['--check', 'app.js'], ['tests/engine-contract.mjs'], ['tests/geometry.mjs']]) {
    const check = spawnSync(process.execPath, command, { cwd: standalone, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stdout + check.stderr);
  }
  const images = await readdir(join(standalone, 'assets/photos'));
  assert.equal(images.filter(name => name.endsWith('.svg')).length, 15, 'standalone has all local sample images');
  assert.ok(images.every(name => name.endsWith('.svg')), 'reference photos and videos are not copied into the reusable package');

  // A 200 response is insufficient: Chrome refuses SVG served as generic
  // binary data, leaving every card blank without a JavaScript error.
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  preview = spawn(process.execPath, ['server.mjs', '--port', String(port)], { cwd: standalone, stdio: ['ignore', 'pipe', 'pipe'] });
  const [started] = await Promise.race([
    once(preview.stdout, 'data'),
    once(preview, 'exit').then(([code]) => { throw new Error(`Preview exited before serving: ${code}`); }),
  ]);
  assert.match(started.toString(), /Preview:/);
  const response = await fetch(`http://127.0.0.1:${port}/assets/photos/01.svg`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/svg+xml', 'SVG samples must be served as decodable images');
  await response.arrayBuffer();
  console.log('skill-package: ok (runtime, standalone, non-overwrite, symlink, approved-engine parity)');
} finally {
  if (preview && preview.exitCode === null) {
    const exited = once(preview, 'exit');
    preview.kill();
    await exited;
  }
  await rm(sandbox, { recursive: true, force: true });
}
