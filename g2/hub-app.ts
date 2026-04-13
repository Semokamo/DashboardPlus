import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { onEvenHubEvent } from './hub-events'
import { showDashboard } from './hub-renderer'
import { state, setBridge } from './hub-state'

const STATIC_SECTIONS = [
  {
    name: 'Telegram',
    preview: 'Telegram\n\nRecent chats\nNadia: Landing in 20 min\nDesign Team: Mock approved\nSaved Messages: Buy coffee\n\nMode: messaging feed mock',
  },
  {
    name: 'AI',
    preview: 'AI\n\nAssistant queue\n- Summarize meeting notes\n- Draft a quick reply\n- Brainstorm travel ideas\n\nMode: assistant actions mock',
  },
  {
    name: 'News',
    preview: 'News\n\nMorning brief\nMarkets open higher\nMajor storm weakens offshore\nNew battery lab opens in Toronto\n\nMode: headline digest mock',
  },
]

export async function refreshState(): Promise<void> {
  state.sections = [...STATIC_SECTIONS]
  if (state.currentSectionIndex >= state.sections.length) {
    state.currentSectionIndex = 0
  }

  appendEventLog(`Hub: loaded ${state.sections.length} sections`)
  await showDashboard()
}

export async function initApp(appBridge: EvenAppBridge): Promise<void> {
  setBridge(appBridge)

  appBridge.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await refreshState()
}
