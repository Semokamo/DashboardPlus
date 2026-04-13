const http = require('http')
const path = require('path')
const fs = require('fs/promises')
const { TelegramClient } = require('telegram')
const { StringSession } = require('telegram/sessions')

const TELEGRAM_API_ID = 22158210
const TELEGRAM_API_HASH = '3501f67d9c9ee495d17b69de38ace041'
const PORT = Number(process.env.TELEGRAM_AUTH_PORT || 8787)
const SESSION_FILE = path.join(__dirname, 'telegram-session.json')
const ENV_FILE = path.join(__dirname, '..', '.env.local')
const FARSI_PATTERN = /[\u0600-\u06FF]/
const transliterationCache = new Map()

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject, settled: false }
}

function settleDeferred(deferred, method, value) {
  if (!deferred || deferred.settled) return
  deferred.settled = true
  deferred[method](value)
}

function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (user?.username) return `@${user.username}`
  if (user?.phone) return user.phone
  return 'Telegram user'
}

async function readStoredSession() {
  try {
    const raw = await fs.readFile(SESSION_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return typeof parsed.session === 'string' ? parsed.session : ''
  } catch {
    return ''
  }
}

let envCache = null

async function readLocalEnv() {
  if (envCache !== null) return envCache

  try {
    const raw = await fs.readFile(ENV_FILE, 'utf8')
    envCache = Object.fromEntries(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=')
          const key = line.slice(0, index).trim()
          const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
          return [key, value]
        }),
    )
  } catch {
    envCache = {}
  }

  return envCache
}

async function getOpenAiApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  const env = await readLocalEnv()
  return env.OPENAI_API_KEY || ''
}

async function writeStoredSession(session, userLabel) {
  await fs.writeFile(
    SESSION_FILE,
    JSON.stringify({ session, userLabel, savedAt: new Date().toISOString() }, null, 2),
    'utf8',
  )
}

async function clearStoredSession() {
  try {
    await fs.unlink(SESSION_FILE)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

async function createClient(sessionValue = '') {
  const session = new StringSession(sessionValue)
  const client = new TelegramClient(session, TELEGRAM_API_ID, TELEGRAM_API_HASH, {
    connectionRetries: 5,
    useWSS: true,
  })
  await client.connect()
  return { client, session }
}

function normalizeDate(value) {
  if (typeof value === 'number') return value < 1_000_000_000_000 ? value * 1000 : value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (typeof value?.valueOf === 'function') {
    const raw = value.valueOf()
    return typeof raw === 'number' ? raw : 0
  }
  return 0
}

function detectDialogKind(entity) {
  const className = entity?.className
  if (className === 'Channel') {
    if (entity?.megagroup) return 'groups'
    if (entity?.broadcast) return 'channels'
  }
  if (className === 'Chat') return 'groups'
  if (className === 'User') return 'chats'
  return null
}

function getDialogTitle(dialog) {
  if (typeof dialog?.title === 'string' && dialog.title.trim()) return dialog.title.trim()
  if (typeof dialog?.name === 'string' && dialog.name.trim()) return dialog.name.trim()

  const entity = dialog?.entity
  if (typeof entity?.title === 'string' && entity.title.trim()) return entity.title.trim()

  const fullName = [entity?.firstName, entity?.lastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (entity?.username) return `@${entity.username}`
  if (entity?.phone) return entity.phone
  return 'Untitled'
}

async function transliterateBatch(titles) {
  const apiKey = await getOpenAiApiKey()
  if (!apiKey || titles.length === 0) {
    return titles
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'Convert Persian/Farsi text into Finglish using English letters only. Keep the order exactly the same and return only a JSON array of strings. Do not translate meaningfully; transliterate pronunciation.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(titles),
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`)
  }

  const data = await response.json()
  const outputText =
    data.output_text ??
    data.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join('') ??
    ''

  const parsed = JSON.parse(outputText)
  if (!Array.isArray(parsed) || parsed.length !== titles.length) {
    throw new Error('Unexpected transliteration response')
  }

  return parsed.map((value, index) => typeof value === 'string' && value.trim() ? value.trim() : titles[index])
}

async function transliterateTitles(items) {
  const pending = []
  const pendingIndexes = []

  items.forEach((item, index) => {
    if (!FARSI_PATTERN.test(item.title)) return

    const cached = transliterationCache.get(item.title)
    if (cached) {
      item.title = cached
      return
    }

    pending.push(item.title)
    pendingIndexes.push(index)
  })

  if (pending.length === 0) return items

  try {
    const transliterated = await transliterateBatch(pending)
    transliterated.forEach((value, index) => {
      transliterationCache.set(pending[index], value)
      items[pendingIndexes[index]].title = value
    })
  } catch {
    // Leave original titles in place if transliteration fails.
  }

  return items
}

async function getDialogs(kind) {
  const storedSession = await readStoredSession()
  if (!storedSession) {
    throw new Error('Telegram is not logged in.')
  }

  let client

  try {
    const created = await createClient(storedSession)
    client = created.client
    const authorized = await client.checkAuthorization()
    if (!authorized) {
      await clearStoredSession()
      throw new Error('Telegram session expired. Please log in again.')
    }

    const dialogs = await client.getDialogs({ limit: 100 })
    const items = dialogs
      .map((dialog) => {
        const entity = dialog?.entity
        const dialogKind = detectDialogKind(entity)
        if (dialogKind !== kind) return null

        return {
          id: String(entity?.id ?? dialog?.id ?? Math.random()),
          title: getDialogTitle(dialog),
          updatedAt: dialog?.date ? new Date(normalizeDate(dialog.date)).toISOString() : null,
          sortKey: normalizeDate(dialog?.date ?? dialog?.message?.date),
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.sortKey - a.sortKey)
      .map(({ sortKey, ...item }) => item)

    return transliterateTitles(items)
  } finally {
    await disconnectClient(client)
  }
}

let loginFlow = null

async function disconnectClient(client) {
  if (!client) return
  try {
    await client.disconnect()
  } catch {
    // Ignore cleanup errors.
  }
}

async function cancelLoginFlow() {
  if (!loginFlow) return

  if (loginFlow.codeReject) {
    loginFlow.codeReject(new Error('Login cancelled'))
  }
  if (loginFlow.passwordReject) {
    loginFlow.passwordReject(new Error('Login cancelled'))
  }
  settleDeferred(loginFlow.waiter, 'reject', new Error('Login cancelled'))

  const client = loginFlow.client
  loginFlow = null
  await disconnectClient(client)
}

function beginWaiter(flow) {
  flow.waiter = createDeferred()
  return flow.waiter.promise
}

async function getStatusSnapshot() {
  const storedSession = await readStoredSession()
  if (!storedSession) {
    return { loggedIn: false, userLabel: null }
  }

  let client
  let session

  try {
    const created = await createClient(storedSession)
    client = created.client
    session = created.session
    const authorized = await client.checkAuthorization()
    if (!authorized) {
      await clearStoredSession()
      return { loggedIn: false, userLabel: null }
    }

    const me = await client.getMe()
    const userLabel = getDisplayName(me)
    await writeStoredSession(session.save(), userLabel)
    return { loggedIn: true, userLabel }
  } catch {
    await clearStoredSession()
    return { loggedIn: false, userLabel: null }
  } finally {
    await disconnectClient(client)
  }
}

async function beginLogin(phoneNumber) {
  await cancelLoginFlow()

  const created = await createClient('')
  const flow = {
    client: created.client,
    session: created.session,
    codeResolve: null,
    codeReject: null,
    passwordResolve: null,
    passwordReject: null,
    waiter: null,
  }

  loginFlow = flow
  const firstWait = beginWaiter(flow)

  void (async () => {
    try {
      await flow.client.start({
        phoneNumber: async () => phoneNumber,
        phoneCode: async () => {
          settleDeferred(flow.waiter, 'resolve', {
            status: 'code_required',
            message: 'Enter the Telegram code from your app.',
          })

          return new Promise((resolve, reject) => {
            flow.codeResolve = resolve
            flow.codeReject = reject
          })
        },
        password: async () => {
          settleDeferred(flow.waiter, 'resolve', {
            status: 'password_required',
            message: 'Enter your Telegram two-step verification password.',
          })

          return new Promise((resolve, reject) => {
            flow.passwordResolve = resolve
            flow.passwordReject = reject
          })
        },
        onError: (error) => {
          throw error
        },
      })

      const me = await flow.client.getMe()
      const userLabel = getDisplayName(me)
      await writeStoredSession(flow.session.save(), userLabel)
      settleDeferred(flow.waiter, 'resolve', {
        status: 'logged_in',
        snapshot: { loggedIn: true, userLabel },
        userLabel,
        message: 'Telegram login complete.',
      })
      loginFlow = null
      await disconnectClient(flow.client)
    } catch (error) {
      settleDeferred(flow.waiter, 'reject', error)
      loginFlow = null
      await disconnectClient(flow.client)
    }
  })()

  return firstWait
}

async function submitCode(code) {
  if (!loginFlow || !loginFlow.codeResolve) {
    throw new Error('There is no pending Telegram code request.')
  }

  const wait = beginWaiter(loginFlow)
  const resolve = loginFlow.codeResolve
  loginFlow.codeResolve = null
  loginFlow.codeReject = null
  resolve(code)
  return wait
}

async function submitPassword(password) {
  if (!loginFlow || !loginFlow.passwordResolve) {
    throw new Error('There is no pending Telegram password request.')
  }

  const wait = beginWaiter(loginFlow)
  const resolve = loginFlow.passwordResolve
  loginFlow.passwordResolve = null
  loginFlow.passwordReject = null
  resolve(password)
  return wait
}

async function logout() {
  await cancelLoginFlow()

  const storedSession = await readStoredSession()
  if (!storedSession) {
    await clearStoredSession()
    return
  }

  let client

  try {
    const created = await createClient(storedSession)
    client = created.client
    const authorized = await client.checkAuthorization()
    if (authorized) {
      await client.logOut()
    }
  } finally {
    await disconnectClient(client)
    await clearStoredSession()
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }

  if (chunks.length === 0) return {}
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendJson(response, 404, { error: 'Missing URL' })
      return
    }

    if (request.method === 'OPTIONS') {
      sendJson(response, 200, { ok: true })
      return
    }

    if (request.method === 'GET' && request.url === '/api/telegram/status') {
      sendJson(response, 200, { snapshot: await getStatusSnapshot() })
      return
    }

    if (request.method === 'GET' && request.url.startsWith('/api/telegram/dialogs')) {
      const url = new URL(request.url, `http://127.0.0.1:${PORT}`)
      const kind = url.searchParams.get('kind')
      if (!['channels', 'chats', 'groups'].includes(kind)) {
        sendJson(response, 400, { error: 'A valid dialog kind is required.' })
        return
      }

      sendJson(response, 200, { items: await getDialogs(kind) })
      return
    }

    if (request.method === 'POST' && request.url === '/api/telegram/start-login') {
      const body = await readBody(request)
      if (typeof body.phoneNumber !== 'string' || !body.phoneNumber.trim()) {
        sendJson(response, 400, { error: 'Phone number is required.' })
        return
      }

      sendJson(response, 200, await beginLogin(body.phoneNumber.trim()))
      return
    }

    if (request.method === 'POST' && request.url === '/api/telegram/submit-code') {
      const body = await readBody(request)
      if (typeof body.code !== 'string' || !body.code.trim()) {
        sendJson(response, 400, { error: 'Telegram code is required.' })
        return
      }

      sendJson(response, 200, await submitCode(body.code.trim()))
      return
    }

    if (request.method === 'POST' && request.url === '/api/telegram/submit-password') {
      const body = await readBody(request)
      if (typeof body.password !== 'string' || !body.password) {
        sendJson(response, 400, { error: 'Telegram password is required.' })
        return
      }

      sendJson(response, 200, await submitPassword(body.password))
      return
    }

    if (request.method === 'POST' && request.url === '/api/telegram/logout') {
      await logout()
      sendJson(response, 200, { ok: true })
      return
    }

    sendJson(response, 404, { error: 'Not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Telegram auth server error'
    sendJson(response, 500, { error: message })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Telegram auth server listening on http://127.0.0.1:${PORT}`)
})
