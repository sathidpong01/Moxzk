import type { LocalServiceName } from '../runtime'

function getBridge() {
  if (typeof window === 'undefined') return null
  return window.mgRuntime?.localServices ?? null
}

export async function withLocalServiceUsage<T>(
  service: LocalServiceName,
  task: () => Promise<T>,
): Promise<T> {
  const bridge = getBridge()
  if (!bridge) return task()

  await bridge.beginUsage(service).catch(() => {})
  try {
    return await task()
  } finally {
    await bridge.endUsage(service).catch(() => {})
  }
}
