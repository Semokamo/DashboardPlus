import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppActions, SetStatus } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, refreshState } from './app'
import { initUI } from './ui'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Even bridge not detected within ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer))
  })
}

export function createHomeActions(setStatus: SetStatus): AppActions {
  initUI()
  let connected = false

  return {
    async connect() {
      setStatus('Itsyhome: connecting to Even bridge...')
      appendEventLog('Itsyhome: connect requested')

      try {
        const bridge = await withTimeout(waitForEvenAppBridge(), 6000)
        await initApp(bridge)
        connected = true
        setStatus('Itsyhome: connected. Tap=actions, DblTap=refresh.')
        appendEventLog('Itsyhome: connected to bridge')
      } catch (err) {
        console.error('[itsyhome] connect failed', err)
        setStatus('Itsyhome: bridge not found. Running in mock mode.')
        appendEventLog('Itsyhome: connection failed')
      }
    },
    async action() {
      if (!connected) {
        setStatus('Itsyhome: not connected')
        appendEventLog('Itsyhome: action blocked (not connected)')
        return
      }

      await refreshState()
      setStatus('Itsyhome: home state refreshed')
      appendEventLog('Itsyhome: manual refresh via action button')
    },
  }
}
