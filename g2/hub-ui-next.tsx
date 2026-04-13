import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Card,
  CardHeader,
  CardContent,
  Text,
  Input,
  Button,
} from '@jappyjan/even-realities-ui'
import { refreshState } from './hub-app'
import {
  TELEGRAM_AUTH_EVENT,
  getTelegramAuthSnapshot,
  logoutTelegram,
  restoreTelegramSession,
  startTelegramLogin,
  submitTelegramCode,
  submitTelegramPassword,
  type TelegramAuthSnapshot,
  type TelegramLoginResult,
} from '../_shared/telegram-auth'

function TelegramPanel() {
  const [snapshot, setSnapshot] = useState<TelegramAuthSnapshot>(() => getTelegramAuthSnapshot())
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'code' | 'password' | 'working'>('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    void restoreTelegramSession().then(setSnapshot).finally(() => setStatus('idle'))

    const handleAuthChanged = () => {
      setSnapshot(getTelegramAuthSnapshot())
    }

    window.addEventListener(TELEGRAM_AUTH_EVENT, handleAuthChanged)
    return () => {
      window.removeEventListener(TELEGRAM_AUTH_EVENT, handleAuthChanged)
    }
  }, [])

  const applyLoginResult = (result: TelegramLoginResult) => {
    if (result.status === 'logged_in') {
      setSnapshot(result.snapshot)
      setCode('')
      setPassword('')
      setStatus('idle')
      return
    }

    if (result.status === 'code_required') {
      setStatus('code')
      return
    }

    setStatus('password')
  }

  const startLogin = async () => {
    if (!phoneNumber.trim()) {
      setError('Enter your phone number first.')
      return
    }

    setError('')
    setStatus('working')

    try {
      const result = await startTelegramLogin(phoneNumber.trim())
      applyLoginResult(result)
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : String(loginError)
      setError(message)
      setStatus('idle')
    }
  }

  const submitCode = async () => {
    if (!code.trim()) return
    setError('')
    setStatus('working')

    try {
      const result = await submitTelegramCode(code.trim())
      applyLoginResult(result)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
      setStatus('code')
    }
  }

  const submitPassword = async () => {
    if (!password) return
    setError('')
    setStatus('working')

    try {
      const result = await submitTelegramPassword(password)
      applyLoginResult(result)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
      setStatus('password')
    }
  }

  const handleLogout = async () => {
    setStatus('working')
    setError('')
    try {
      await logoutTelegram()
      setSnapshot(getTelegramAuthSnapshot())
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : String(logoutError))
    } finally {
      setStatus('idle')
    }
  }

  return (
    <Card style={{ width: '100%' }}>
      <CardHeader>
        <Text variant="title-1">Telegram</Text>
        <Text variant="body-2" style={{ color: 'var(--color-tc-2)', marginTop: '4px', display: 'block' }}>
          Sign in here so the Telegram section can open inside the glasses UI.
        </Text>
      </CardHeader>
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Text variant="body-2">
          {snapshot.loggedIn
            ? `Logged in as ${snapshot.userLabel ?? 'Telegram user'}`
            : 'Not logged in'}
        </Text>

        {!snapshot.loggedIn && (
          <>
            <Input
              value={phoneNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
              placeholder="+1 555 123 4567"
              style={{ width: '100%' }}
            />
            <Button variant="primary" style={{ width: '100%' }} onClick={startLogin} disabled={status !== 'idle'}>
              {status === 'working' ? 'Working...' : 'Start Telegram login'}
            </Button>
          </>
        )}

        {status === 'code' && (
          <>
            <Input
              value={code}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
              placeholder="Telegram code"
              style={{ width: '100%' }}
            />
            <Button variant="default" style={{ width: '100%' }} onClick={submitCode}>
              Submit code
            </Button>
          </>
        )}

        {status === 'password' && (
          <>
            <Input
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="Telegram password"
              style={{ width: '100%' }}
            />
            <Button variant="default" style={{ width: '100%' }} onClick={submitPassword}>
              Submit password
            </Button>
          </>
        )}

        {snapshot.loggedIn && (
          <Button variant="default" style={{ width: '100%' }} onClick={handleLogout} disabled={status === 'working'}>
            Log out
          </Button>
        )}

        {error && (
          <Text variant="body-2" style={{ color: 'var(--color-tc-red, #FF4535)' }}>
            {error}
          </Text>
        )}
      </CardContent>
    </Card>
  )
}

function OverviewPanel() {
  const handleRefresh = () => {
    void refreshState()
  }

  const handleConnect = () => {
    document.getElementById('connectBtn')?.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Card style={{ width: '100%' }}>
        <CardHeader>
          <Text variant="title-1">DashboardPlus</Text>
          <Text variant="body-2" style={{ color: 'var(--color-tc-2)', marginTop: '4px', display: 'block' }}>
            A glasses dashboard shell built from the current Even G2 layout.
          </Text>
        </CardHeader>
        <CardContent>
          <Text variant="body-2">
            Left side: Home, Telegram, AI, News
          </Text>
          <Text variant="body-2">
            Right side: placeholder preview text for the selected section
          </Text>
        </CardContent>
      </Card>
      <TelegramPanel />
      <Card style={{ width: '100%' }}>
        <CardHeader>
          <Text variant="title-1">Controls</Text>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button variant="primary" style={{ width: '100%' }} onClick={handleConnect}>
            Connect DashboardPlus
          </Button>
          <Button variant="default" style={{ width: '100%' }} onClick={handleRefresh}>
            Reload static sections
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function initUI(): void {
  const app = document.getElementById('app')
  if (!app) return

  for (const id of ['actionBtn']) {
    const el = document.getElementById(id)
    if (el) el.remove()
  }

  const connectBtn = document.getElementById('connectBtn')
  if (connectBtn) connectBtn.style.display = 'none'
  const eventLog = document.getElementById('event-log')
  if (eventLog) {
    eventLog.removeAttribute('hidden')
    eventLog.setAttribute(
      'style',
      'margin: 24px 0 0; white-space: pre-wrap; max-height: 240px; overflow: auto; font-size: 12px;',
    )
  }

  const heading = app.querySelector('h1')
  const status = document.getElementById('status')
  if (heading) app.appendChild(heading)
  if (status) app.appendChild(status)

  const container = document.createElement('div')
  container.style.margin = '48px 0'
  app.insertBefore(container, heading)

  createRoot(container).render(
    <React.StrictMode>
      <OverviewPanel />
    </React.StrictMode>,
  )
}
