import { performance } from 'perf_hooks'
import { pathToFileURL, fileURLToPath } from 'url'
import { dirname, join } from 'path'

const colorize = (color) => (text) => `\u001b[${color}m${text}\u001b[0m`
const clear = colorize(0)
const red = colorize(31)
const green = colorize(32)
const yellow = colorize(33)
const blue = colorize(34)
const magenta = colorize(35)
const cyan = colorize(36)
const white = colorize(37)

const start = performance.now()
const rootDir = dirname(fileURLToPath(import.meta.url))

const finish = async (err, name) => {
  const elapsed = performance.now() - start
  console.log(yellow('\nTIME:'), `completed in ${yellow(fmtTime(elapsed))}`)
}

const ellipsis = (m) =>
  m.length <= process.stdout.columns - 12
    ? m
    : m
        .slice(0, cap - 1)
        .trim()
        .padEnd(cap, '…')

const removeDot = (n) => (n.endsWith('.') ? ` ${n.slice(0, -1)}` : n)
const fmtTime = (elapsed) =>
  elapsed > 999
    ? `${removeDot((elapsed / 1000).toFixed(3).slice(0, 4))}s`
    : `${removeDot(elapsed.toFixed(2).slice(0, 3))}ms`

const filePath = 'tests.js'
console.log('\n -> running tests of', cyan(filePath))
const { t } = await import(pathToFileURL(join(rootDir, filePath)))
let prev = performance.now()

for (const [name, test] of Object.entries(t)) {
  try {
    await test()
    const end = performance.now()
    console.log(green('PASS:'), yellow(fmtTime(end - prev)), ellipsis(name))
    prev = end
  } catch (err) {
    await finish()
    console.log(red('FAIL:'), name)
    err.response?.body
      ? console.error(err.message, err.response.body)
      : console.error(err)
    process.exit(1)
  }
}

await finish()
console.log('All tests passed')
