interface RequestTimeoutOptions {
  label: string
  signal?: AbortSignal
  timeoutMs?: number
}

export async function runWithRequestTimeout<T>(
  options: RequestTimeoutOptions,
  run: (signal: AbortSignal | undefined) => Promise<T>,
): Promise<T> {
  if (!options.timeoutMs || options.timeoutMs <= 0) {
    return run(options.signal)
  }

  const controller = new AbortController()
  let timedOut = false
  const parentSignal = options.signal
  const onAbort = () => controller.abort(parentSignal?.reason)
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort(new DOMException(`${options.label} request timed out after ${options.timeoutMs}ms`, 'TimeoutError'))
  }, options.timeoutMs)

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason)
    } else {
      parentSignal.addEventListener('abort', onAbort, { once: true })
    }
  }

  try {
    return await run(controller.signal)
  } catch (error) {
    if (timedOut) {
      throw new Error(`${options.label} request timed out after ${options.timeoutMs}ms`)
    }
    throw error instanceof Error ? error : new Error(String(error))
  } finally {
    clearTimeout(timeoutId)
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onAbort)
    }
  }
}
