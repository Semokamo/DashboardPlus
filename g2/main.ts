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
      setStatus('itsyhome: connecting to Even bridge...')
      appendEventLog('itsyhome: connect requested')

      try {
        const bridge = await withTimeout(waitForEvenAppBridge(), 6000)
        await initApp(bridge)
        connected = true
        setStatus('itsyhome: connected. Tap=actions, DblTap=refresh.')
        appendEventLog('itsyhome: connected to bridge')
      } catch (err) {
        console.error('[itsyhome] connect failed', err)
        setStatus('itsyhome: bridge not found. Running in mock mode.')
        appendEventLog('itsyhome: connection failed')
      }
    },
    async action() {
      if (!connected) {
        setStatus('itsyhome: not connected')
        appendEventLog('itsyhome: action blocked (not connected)')
        return
      }

      await refreshState()
      setStatus('itsyhome: home state refreshed')
      appendEventLog('itsyhome: manual refresh via action button')
    },
  }
}
