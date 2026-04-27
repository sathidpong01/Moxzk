import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createServer } from 'vite'

const viteServerPromise = createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})
const localServicesModulePromise = viteServerPromise.then((server) => server.ssrLoadModule('/electron/main/localServices.ts'))

after(async () => {
  const server = await viteServerPromise
  await server.close()
})

class FakeChildProcess extends EventEmitter {
  constructor(pid) {
    super()
    this.pid = pid
    this.exitCode = null
  }

  unref() {}
}

function createHarness(factory) {
  let now = 1_000
  let nextPid = 200
  const readiness = { panelcleaner: false, ollama: false }
  const timers = []
  const killed = []
  const children = new Map()

  const manager = factory({
    now: () => now,
    setTimeout: (fn, ms) => {
      const timer = { fn, ms, cleared: false }
      timers.push(timer)
      return timer
    },
    clearTimeout: (timer) => {
      timer.cleared = true
    },
    sleep: async (ms) => {
      now += ms
    },
    isServiceReady: async (url) => url.includes('5055') ? readiness.panelcleaner : readiness.ollama,
    spawnService: (name) => {
      readiness[name] = true
      const child = new FakeChildProcess(nextPid++)
      children.set(name, child)
      return child
    },
    killService: async (name, pid) => {
      killed.push({ name, pid })
      readiness[name] = false
      const child = children.get(name)
      if (child) {
        child.exitCode = 0
        child.emit('exit', 0, null)
      }
    },
  })

  return {
    manager,
    killed,
    timers,
    readiness,
    advance(ms) {
      now += ms
    },
    runLastTimer() {
      const timer = [...timers].reverse().find((item) => !item.cleared)
      assert.ok(timer, 'expected an active timer')
      timer.cleared = true
      timer.fn()
    },
  }
}

test('service manager marks spawned services as owned by the app', async () => {
  const { createLocalServiceManager } = await localServicesModulePromise
  const harness = createHarness(createLocalServiceManager)

  const result = await harness.manager.start('panelcleaner')
  const status = await harness.manager.getManagedStatus()

  assert.equal(result.ok, true)
  assert.equal(status.panelcleaner.running, true)
  assert.equal(status.panelcleaner.ownedByApp, true)
  assert.equal(status.panelcleaner.idleTimeoutMs, 300000)
})

test('service manager treats pre-existing healthy services as external', async () => {
  const { createLocalServiceManager } = await localServicesModulePromise
  const harness = createHarness(createLocalServiceManager)
  harness.readiness.ollama = true

  const result = await harness.manager.start('ollama')
  const status = await harness.manager.getManagedStatus()

  assert.equal(result.ok, true)
  assert.equal(status.ollama.running, true)
  assert.equal(status.ollama.ownedByApp, false)
})

test('beginUsage and endUsage update in-flight count and arm idle timer only after work finishes', async () => {
  const { createLocalServiceManager } = await localServicesModulePromise
  const harness = createHarness(createLocalServiceManager)
  await harness.manager.start('panelcleaner')

  harness.manager.beginUsage('panelcleaner')
  let status = await harness.manager.getManagedStatus()
  assert.equal(status.panelcleaner.inFlightCount, 1)
  assert.equal(status.panelcleaner.idleDeadlineAt, null)

  harness.manager.endUsage('panelcleaner')
  status = await harness.manager.getManagedStatus()
  assert.equal(status.panelcleaner.inFlightCount, 0)
  assert.equal(status.panelcleaner.idleDeadlineAt, 301000)
})

test('new activity resets the idle deadline', async () => {
  const { createLocalServiceManager } = await localServicesModulePromise
  const harness = createHarness(createLocalServiceManager)
  await harness.manager.start('ollama')

  harness.manager.beginUsage('ollama')
  harness.manager.endUsage('ollama')
  const first = (await harness.manager.getManagedStatus()).ollama.idleDeadlineAt

  harness.advance(10_000)
  harness.manager.beginUsage('ollama')
  harness.manager.endUsage('ollama')
  const second = (await harness.manager.getManagedStatus()).ollama.idleDeadlineAt

  assert.ok(first != null)
  assert.ok(second != null)
  assert.ok(second > first)
  assert.equal(second - first, 10_000)
})

test('owned services stop themselves after idle timeout', async () => {
  const { createLocalServiceManager } = await localServicesModulePromise
  const harness = createHarness(createLocalServiceManager)
  await harness.manager.start('panelcleaner')

  harness.manager.beginUsage('panelcleaner')
  harness.manager.endUsage('panelcleaner')
  harness.runLastTimer()

  const status = await harness.manager.getManagedStatus()
  assert.equal(status.panelcleaner.running, false)
  assert.deepEqual(harness.killed, [{ name: 'panelcleaner', pid: 200 }])
})

test('external services are never auto-stopped by idle logic', async () => {
  const { createLocalServiceManager } = await localServicesModulePromise
  const harness = createHarness(createLocalServiceManager)
  harness.readiness.panelcleaner = true
  await harness.manager.start('panelcleaner')

  harness.manager.beginUsage('panelcleaner')
  harness.manager.endUsage('panelcleaner')
  const status = await harness.manager.getManagedStatus()

  assert.equal(status.panelcleaner.ownedByApp, false)
  assert.equal(status.panelcleaner.idleDeadlineAt, null)
  assert.deepEqual(harness.killed, [])
})

test('stopOwnedServices only stops services started by the app', async () => {
  const { createLocalServiceManager } = await localServicesModulePromise
  const harness = createHarness(createLocalServiceManager)
  harness.readiness.panelcleaner = true
  await harness.manager.start('panelcleaner')
  await harness.manager.start('ollama')

  const result = await harness.manager.stopOwnedServices()
  const status = await harness.manager.getManagedStatus()

  assert.equal(result.ok, true)
  assert.deepEqual(harness.killed, [{ name: 'ollama', pid: 200 }])
  assert.equal(status.panelcleaner.running, true)
  assert.equal(status.panelcleaner.ownedByApp, false)
  assert.equal(status.ollama.running, false)
})
