import { fileURLToPath } from 'node:url'
import { buildSmokeConfig, extractCookieHeader } from './auth-smoke-user.mjs'
import { loadSmokeEnv } from './smoke-env.mjs'

export async function runWorkerSmoke({
  baseUrl,
  email,
  password,
  username,
  fetchImpl = fetch,
}) {
  const checks = []
  let cookieHeader = ''
  let albumId = null
  let objectKey = null

  const anonymous = await requestJson(fetchImpl, baseUrl, '/api/auth/me')
  if (anonymous.status === 401 || (anonymous.ok && anonymous.payload?.user === null)) {
    checks.push({ name: 'auth.no_cookie_requires_login', status: anonymous.status })
  } else {
    throw new Error(`Expected auth/me without cookie to require login, got ${anonymous.status}.`)
  }

  const auth = await loginOrRegister(fetchImpl, baseUrl, { email, password, username })
  cookieHeader = auth.cookieHeader
  const me = await requestJson(fetchImpl, baseUrl, '/api/auth/me', { cookieHeader })
  if (!me.ok || !me.payload?.user) throw new Error(`auth/me with session failed: ${me.status} ${me.message}`)
  checks.push({ name: 'auth.session_me', mode: auth.mode })

  try {
    const albumTitle = `MG Smoke ${new Date().toISOString()}`
    const album = await expectData(await requestJson(fetchImpl, baseUrl, '/api/albums', {
      method: 'POST',
      cookieHeader,
      body: { title: albumTitle, description: 'worker smoke', sourceLang: 'auto' },
    }), 'create album')
    albumId = album.id
    checks.push({ name: 'album.create', id: album.id })

    const albums = await expectData(await requestJson(fetchImpl, baseUrl, '/api/albums', { cookieHeader }), 'list albums')
    if (!Array.isArray(albums) || !albums.some((item) => item.id === album.id)) {
      throw new Error('Created album was not returned by list albums.')
    }
    checks.push({ name: 'album.list' })

    await expectOk(await requestJson(fetchImpl, baseUrl, `/api/albums/${encodeURIComponent(album.id)}`, {
      method: 'PATCH',
      cookieHeader,
      body: { title: `${albumTitle} Updated`, description: 'ok' },
    }), 'update album')
    checks.push({ name: 'album.update' })

    const page = await expectData(await requestJson(fetchImpl, baseUrl, `/api/albums/${encodeURIComponent(album.id)}/pages`, {
      method: 'POST',
      cookieHeader,
      body: { pageNumber: 1 },
    }), 'create page')
    checks.push({ name: 'page.create', id: page.id })

    const region = {
      id: 'smoke-region',
      bbox: { x: 8, y: 8, width: 80, height: 40 },
      originalText: 'hello',
      translatedText: 'สวัสดี',
      mood: 'normal',
      suggestedFont: 'normal',
      fontSize: 18,
      fontColor: '#111111',
      rotation: 0,
      strokeWidth: 0,
      strokeColor: '#ffffff',
    }
    const brushStroke = { id: 'smoke-brush', points: [1, 2, 3, 4], color: '#fff', width: 4, opacity: 1, shadowBlur: 0, tool: 'brush' }
    await expectOk(await requestJson(fetchImpl, baseUrl, `/api/pages/${encodeURIComponent(page.id)}`, {
      method: 'PATCH',
      cookieHeader,
      body: {
        status: 'translated',
        processingMode: 'full',
        regions: [region],
        brushStrokes: [brushStroke],
        artboardX: 40,
        artboardY: 48,
      },
    }), 'update page')
    checks.push({ name: 'page.update' })

    await expectOk(await requestJson(fetchImpl, baseUrl, `/api/albums/${encodeURIComponent(album.id)}/pages/reorder`, {
      method: 'POST',
      cookieHeader,
      body: { pageIds: [page.id] },
    }), 'reorder pages')
    checks.push({ name: 'page.reorder' })

    const pages = await expectData(await requestJson(fetchImpl, baseUrl, `/api/albums/${encodeURIComponent(album.id)}/pages`, { cookieHeader }), 'list pages')
    const savedPage = Array.isArray(pages) ? pages.find((item) => item.id === page.id) : null
    if (!savedPage || savedPage.status !== 'translated' || savedPage.artboardX !== 40) {
      throw new Error('Updated page metadata was not returned by list pages.')
    }
    checks.push({ name: 'page.list' })

    const upload = await uploadSmokeObject(fetchImpl, baseUrl, cookieHeader, album.id, page.id)
    objectKey = upload.key
    checks.push({ name: 'storage.upload', key: objectKey })

    const objectResponse = await fetchImpl(`${baseUrl}/api/storage/object/${encodeURIComponent(objectKey)}`, {
      method: 'GET',
      headers: { Cookie: cookieHeader },
    })
    if (!objectResponse.ok) throw new Error(`download object failed: ${objectResponse.status}`)
    checks.push({ name: 'storage.download' })

    const foreignResponse = await fetchImpl(`${baseUrl}/api/storage/object/${encodeURIComponent('users/someone-else/albums/foreign/0001_original.webp')}`, {
      method: 'GET',
      headers: { Cookie: cookieHeader },
    })
    if (foreignResponse.status !== 404) throw new Error(`foreign object key should be hidden as 404, got ${foreignResponse.status}`)
    checks.push({ name: 'storage.foreign_key_blocked' })

    await expectOk(await requestJson(fetchImpl, baseUrl, `/api/storage/object/${encodeURIComponent(objectKey)}`, {
      method: 'DELETE',
      cookieHeader,
    }), 'delete object')
    objectKey = null
    checks.push({ name: 'storage.delete' })

    await expectOk(await requestJson(fetchImpl, baseUrl, `/api/albums/${encodeURIComponent(album.id)}`, {
      method: 'DELETE',
      cookieHeader,
    }), 'delete album')
    albumId = null
    checks.push({ name: 'album.delete' })
  } finally {
    if (objectKey) {
      await requestJson(fetchImpl, baseUrl, `/api/storage/object/${encodeURIComponent(objectKey)}`, {
        method: 'DELETE',
        cookieHeader,
      }).catch(() => null)
    }
    if (albumId) {
      await requestJson(fetchImpl, baseUrl, `/api/albums/${encodeURIComponent(albumId)}`, {
        method: 'DELETE',
        cookieHeader,
      }).catch(() => null)
    }
  }

  await expectOk(await requestJson(fetchImpl, baseUrl, '/api/auth/logout', {
    method: 'POST',
    cookieHeader,
  }), 'logout')
  checks.push({ name: 'auth.logout' })

  return { ok: true, baseUrl, checks }
}

async function loginOrRegister(fetchImpl, baseUrl, { email, password, username }) {
  let response = await requestJson(fetchImpl, baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { email, password, username },
  })
  let mode = 'registered'

  if (response.status === 409) {
    mode = 'logged-in'
    response = await requestJson(fetchImpl, baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
  }

  if (!response.ok) throw new Error(`${mode === 'registered' ? 'Register' : 'Login'} failed: ${response.status} ${response.message}`)
  const cookieHeader = extractCookieHeader(response.setCookieHeaders)
  if (!cookieHeader) throw new Error('Worker smoke did not receive a session cookie.')
  return { mode, cookieHeader }
}

async function uploadSmokeObject(fetchImpl, baseUrl, cookieHeader, albumId, pageId) {
  const form = new FormData()
  form.append('albumId', albumId)
  form.append('pageId', pageId)
  form.append('pageNumber', '1')
  form.append('kind', 'original')
  form.append('file', new File([new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4])], 'smoke.webp', { type: 'image/webp' }))

  const response = await fetchImpl(`${baseUrl}/api/storage/upload`, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
    body: form,
  })
  const payload = await readJsonResponse(response)
  if (!response.ok || !payload?.key) {
    throw new Error(`upload object failed: ${response.status} ${payload?.error?.message || response.statusText}`)
  }
  return payload
}

async function requestJson(fetchImpl, baseUrl, path, { method = 'GET', body, cookieHeader } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (cookieHeader) headers.Cookie = cookieHeader

  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await readJsonResponse(response)
  return {
    ok: response.ok,
    status: response.status,
    payload,
    message: payload?.error?.message || response.statusText || 'Request failed',
    setCookieHeaders: getSetCookieHeaders(response),
  }
}

async function readJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie()
  const value = response.headers.get('set-cookie')
  return value ? [value] : []
}

async function expectOk(response, label) {
  if (!response.ok) throw new Error(`${label} failed: ${response.status} ${response.message}`)
  return response.payload
}

async function expectData(response, label) {
  const payload = await expectOk(response, label)
  if (!payload || !('data' in payload)) throw new Error(`${label} did not return data.`)
  return payload.data
}

async function main() {
  const config = buildSmokeConfig(loadSmokeEnv())
  const result = await runWorkerSmoke(config)
  console.log(JSON.stringify({
    ok: result.ok,
    baseUrl: result.baseUrl,
    checks: result.checks.map((check) => check.name),
  }, null, 2))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
