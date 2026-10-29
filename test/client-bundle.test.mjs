/**
 * The committed browser bundle must be exactly what `lib/src/*.js` generates, and
 * it must stay a plain classic script that only asks the platform for React.
 */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

test('lib/client.js is generated from lib/src and up to date', async () => {
  const check = await run(process.execPath, [join(packageRoot, 'scripts', 'build-client.mjs'), '--check'], {
    cwd: packageRoot,
  }).then(
    (result) => result,
    (error) => error,
  )
  assert.equal(
    check.code ?? 0,
    0,
    `client bundle is stale; run \`node scripts/build-client.mjs\`\n${check.stdout ?? ''}${check.stderr ?? ''}`,
  )

  const generated = await readFile(join(packageRoot, 'lib', 'client.js'), 'utf8')
  assert.match(generated, /window\.__ModuleLoader__\.load\(/)
  assert.ok(
    generated.includes("id: '@moyumole/dsh-plugin-updates'"),
    'the factory id must equal the scoped package name',
  )
  assert.match(generated, /return \{ inject, apply \}/)
  assert.doesNotMatch(generated, /^\s*import\s/m, 'the bundle must not contain module imports')
  assert.doesNotMatch(generated, /^\s*export\s/m, 'the bundle must not contain module exports')

  const requests = [...generated.matchAll(/require\('([^']+)'\)/g)].map((match) => match[1])
  assert.deepEqual([...new Set(requests)], ['react'], 'only React is requested from the platform module table')
})

test('lib/client.js parses as a classic script', async () => {
  const result = await run(process.execPath, ['--check', join(packageRoot, 'lib', 'client.js')]).then(
    (value) => value,
    (error) => error,
  )
  assert.equal(result.code ?? 0, 0, `${result.stdout ?? ''}${result.stderr ?? ''}`)
})
