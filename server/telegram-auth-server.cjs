const http = require('http')
const path = require('path')
const fs = require('fs/promises')
const { TelegramClient } = require('telegram')
const { StringSession } = require('telegram/sessions')

const TELEGRAM_API_ID = 22158210
const TELEGRAM_API_HASH = '3501f67d9c9ee495d17b69de38ace041'
const PORT = Number(process.env.TELEGRAM_AUTH_PORT || 8787)
const SESSION_FILE = path.join(__dirname, 'telegram-session.json')

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
