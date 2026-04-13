import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppActions, SetStatus } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, refreshState } from './hub-app'
import { initUI } from './hub-ui-next'

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
      setStatus('DashboardPlus: connecting to Even bridge...')
      appendEventLog('DashboardPlus: connect requested')

      try {
        const bridge = await withTimeout(waitForEvenAppBridge(), 6000)
        await initApp(bridge)
        connected = true
        setStatus('DashboardPlus: connected. Browse Telegram, AI and News on the glasses.')
        appendEventLog('DashboardPlus: connected to bridge')
      } catch (err) {
        console.error('[dashboardplus] connect failed', err)
        setStatus('DashboardPlus: bridge not found. Open the simulator and try again.')
        appendEventLog('DashboardPlus: connection failed')
      }
    },
    async action() {
      if (!connected) {
        setStatus('DashboardPlus: not connected')
        appendEventLog('DashboardPlus: action blocked (not connected)')
        return
      }

      await refreshState()
      setStatus('DashboardPlus: sections refreshed')
      appendEventLog('DashboardPlus: manual refresh')
    },
  }
}
