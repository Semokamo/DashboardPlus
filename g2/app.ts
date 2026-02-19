import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { getStatus, getRooms } from './api'
import { state, setBridge } from './state'
import { showDashboard } from './renderer'
import { onEvenHubEvent, setRefreshState } from './events'

export async function refreshState(): Promise<void> {
  try {
    const [status, rooms] = await Promise.all([getStatus(), getRooms()])
    state.status = status
    state.rooms = rooms
    appendEventLog('State: refreshed')
  } catch (err) {
    console.error('[itsyhome] refreshState failed', err)
    appendEventLog(`State: refresh failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (state.screen === 'dashboard' || state.screen === 'confirmation') {
    await showDashboard()
  }
}

export async function initApp(appBridge: EvenAppBridge): Promise<void> {
  setBridge(appBridge)
  setRefreshState(refreshState)

  appBridge.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await refreshState()
  await showDashboard()

  setInterval(() => { void refreshState() }, 30_000)
}
