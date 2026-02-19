import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { getRoomDevices, getDeviceInfo, sendAction } from './api'
import { actionsForDevice, resolveLabel, resolvePath } from './actions'
import type { ActionItem } from './actions'
import * as navigation from './navigation'
import { state } from './state'
import { showDashboard, showMenu, showDeviceScreen, showLoading, showConfirmation } from './renderer'

// Forward declaration – set by app.ts to avoid circular import
let refreshStateFn: () => Promise<void> = async () => {}

export function setRefreshState(fn: () => Promise<void>): void {
  refreshStateFn = fn
}

// --- Event normalisation (copied from tesla) ---

export function resolveEventType(event: EvenHubEvent): OsEventTypeList | undefined {
  const raw =
    event.listEvent?.eventType ??
    event.textEvent?.eventType ??
    event.sysEvent?.eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).event_type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).Event_Type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).type

  if (typeof raw === 'number') {
    switch (raw) {
      case 0: return OsEventTypeList.CLICK_EVENT
      case 1: return OsEventTypeList.SCROLL_TOP_EVENT
      case 2: return OsEventTypeList.SCROLL_BOTTOM_EVENT
      case 3: return OsEventTypeList.DOUBLE_CLICK_EVENT
      default: return undefined
    }
  }

  if (typeof raw === 'string') {
    const v = raw.toUpperCase()
    if (v.includes('DOUBLE')) return OsEventTypeList.DOUBLE_CLICK_EVENT
    if (v.includes('CLICK')) return OsEventTypeList.CLICK_EVENT
    if (v.includes('SCROLL_TOP') || v.includes('UP')) return OsEventTypeList.SCROLL_TOP_EVENT
    if (v.includes('SCROLL_BOTTOM') || v.includes('DOWN')) return OsEventTypeList.SCROLL_BOTTOM_EVENT
  }

  if (event.listEvent || event.textEvent || event.sysEvent) return OsEventTypeList.CLICK_EVENT

  return undefined
}

// --- Command execution ---

async function executeCommand(path: string, label: string): Promise<void> {
  await showLoading(label)

  const result = await sendAction(path)
  if (result.ok) {
    appendEventLog(`Action: ${label} succeeded`)
    await showConfirmation(label + ' \u2013 OK')
  } else {
    appendEventLog(`Action: ${label} failed: ${result.error}`)
    await showConfirmation(`Failed: ${result.error}`)
  }

  setTimeout(() => {
    if (state.screen === 'confirmation') {
      void returnFromConfirmation()
    }
  }, 2000)
}

// --- Return from confirmation ---

async function returnFromConfirmation(): Promise<void> {
  // Pop any action/preset menu levels
  while (navigation.depth() > 0) {
    const level = navigation.current()
    if (level?.kind === 'actions') {
      navigation.pop()
    } else {
      break
    }
  }

  if (state.currentDevice && state.currentRoom) {
    try {
      state.currentDevice = await getDeviceInfo(state.currentRoom, state.currentDevice.name)
    } catch { /* keep existing */ }
    await showDeviceScreen()
  } else {
    await refreshStateFn()
  }
}

// --- Action handler ---

async function handleAction(item: ActionItem): Promise<void> {
  if (item.type === 'refresh') {
    await refreshStateFn()
    return
  }

  if (item.type === 'submenu') {
    navigation.push({ kind: 'actions', label: item.label, items: item.children })
    await showMenu()
    return
  }

  const path = resolvePath(item)
  if (path) {
    const label = resolveLabel(item)
    await executeCommand(path, label)
  }
}

// --- Back navigation ---

async function goBack(): Promise<void> {
  if (state.screen === 'device') {
    state.currentDevice = null
    if (navigation.depth() > 0) {
      await showMenu()
    } else {
      await showDashboard()
    }
    return
  }

  // screen is 'menu'
  navigation.pop()

  if (state.currentDevice) {
    await showDeviceScreen()
  } else if (navigation.depth() > 0) {
    await showMenu()
  } else {
    await showDashboard()
  }
}

// --- Dashboard events ---

async function handleDashboardEvent(event: EvenHubEvent, eventType: OsEventTypeList | undefined): Promise<void> {
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    await refreshStateFn()
    return
  }

  if (eventType !== OsEventTypeList.CLICK_EVENT) return

  const idx = event.listEvent?.currentSelectItemIndex ?? 0
  if (idx < 0 || idx >= state.rooms.length) return

  const room = state.rooms[idx]
  state.currentRoom = room.name

  try {
    const devices = await getRoomDevices(room.name)
    navigation.push({ kind: 'devices', room: room.name, devices })
    await showMenu()
  } catch (err) {
    appendEventLog(`Fetch devices failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// --- Menu events ---

async function handleMenuEvent(event: EvenHubEvent, eventType: OsEventTypeList | undefined): Promise<void> {
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    await goBack()
    return
  }

  if (eventType !== OsEventTypeList.CLICK_EVENT) return

  const idx = event.listEvent?.currentSelectItemIndex ?? 0

  // Index 0 is always "< Back"
  if (idx === 0) {
    await goBack()
    return
  }

  const level = navigation.current()
  if (!level) {
    await showDashboard()
    return
  }

  const menuIdx = idx - 1

  if (level.kind === 'devices') {
    if (menuIdx >= level.devices.length) return
    state.currentDevice = level.devices[menuIdx]
    await showDeviceScreen()
    return
  }

  // kind === 'actions'
  if (menuIdx >= level.items.length) return
  await handleAction(level.items[menuIdx])
}

// --- Device screen events ---

async function handleDeviceEvent(event: EvenHubEvent, eventType: OsEventTypeList | undefined): Promise<void> {
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    await goBack()
    return
  }

  if (eventType !== OsEventTypeList.CLICK_EVENT) return

  const idx = event.listEvent?.currentSelectItemIndex ?? 0

  if (idx === 0) {
    await goBack()
    return
  }

  const info = state.currentDevice
  if (!info) return

  const actions = actionsForDevice(info)
  const actionIdx = idx - 1
  if (actionIdx >= actions.length) return

  await handleAction(actions[actionIdx])
}

// --- Confirmation events ---

async function handleConfirmationEvent(): Promise<void> {
  await returnFromConfirmation()
}

// --- Top-level dispatcher ---

export function onEvenHubEvent(event: EvenHubEvent): void {
  const eventType = resolveEventType(event)
  appendEventLog(`Event: type=${String(eventType)} screen=${state.screen}`)

  switch (state.screen) {
    case 'dashboard':
      void handleDashboardEvent(event, eventType)
      break
    case 'menu':
      void handleMenuEvent(event, eventType)
      break
    case 'device':
      void handleDeviceEvent(event, eventType)
      break
    case 'confirmation':
      void handleConfirmationEvent()
      break
  }
}
