import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { showDashboard, showDetail, updatePreview } from './hub-renderer'
import { state } from './hub-state'

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
    const value = raw.toUpperCase()
    if (value.includes('DOUBLE')) return OsEventTypeList.DOUBLE_CLICK_EVENT
    if (value.includes('CLICK')) return OsEventTypeList.CLICK_EVENT
    if (value.includes('SCROLL_TOP') || value.includes('UP')) return OsEventTypeList.SCROLL_TOP_EVENT
    if (value.includes('SCROLL_BOTTOM') || value.includes('DOWN')) return OsEventTypeList.SCROLL_BOTTOM_EVENT
  }

  if (event.listEvent || event.textEvent || event.sysEvent) return OsEventTypeList.CLICK_EVENT
  return undefined
}

async function updateSelection(index: number): Promise<void> {
  if (index < 0 || index >= state.sections.length) return
  if (index === state.currentSectionIndex) return

  state.currentSectionIndex = index
  state.armedSectionIndex = index
  appendEventLog(`Hub: selected ${state.sections[index]?.name ?? 'unknown'}`)
  if (state.screen === 'dashboard') {
    await updatePreview()
  }
}

function resolveSelectedIndex(event: EvenHubEvent): number | null {
  const indexFromList = event.listEvent?.currentSelectItemIndex
  if (typeof indexFromList === 'number') return indexFromList

  const raw = (event.jsonData ?? {}) as Record<string, unknown>
  const rawIndex =
    raw.currentSelectItemIndex ??
    raw.current_select_item_index ??
    raw.selectIndex ??
    raw.selectedIndex

  if (typeof rawIndex === 'number') return rawIndex
  if (typeof rawIndex === 'string') {
    const parsed = Number(rawIndex)
    if (Number.isInteger(parsed)) return parsed
  }

  const selectedName = event.listEvent?.currentSelectItemName
    ?? (typeof raw.currentSelectItemName === 'string' ? raw.currentSelectItemName : null)
    ?? (typeof raw.current_select_item_name === 'string' ? raw.current_select_item_name : null)
    ?? (typeof raw.itemName === 'string' ? raw.itemName : null)
    ?? (typeof raw.currentItemName === 'string' ? raw.currentItemName : null)
    ?? (typeof raw.selectedName === 'string' ? raw.selectedName : null)

  if (selectedName) {
    const normalized = selectedName.trim().toLowerCase()
    const resolvedIndex = state.sections.findIndex(
      (section) => section.name.trim().toLowerCase() === normalized,
    )
    if (resolvedIndex >= 0) return resolvedIndex
  }

  const isBareSectionsClick =
    raw.containerName === 'sections' &&
    raw.containerID === 1 &&
    raw.currentSelectItemIndex === undefined &&
    raw.current_select_item_index === undefined &&
    raw.selectIndex === undefined &&
    raw.selectedIndex === undefined &&
    !selectedName

  if (isBareSectionsClick) {
    return 0
  }

  return null
}

async function handleDashboardEvent(event: EvenHubEvent): Promise<void> {
  const index = resolveSelectedIndex(event)
  appendEventLog(
    `Hub: click index=${String(index)} name=${event.listEvent?.currentSelectItemName ?? 'n/a'}`,
  )
  if (index === null) return

  if (index === state.currentSectionIndex && state.armedSectionIndex === index) {
    state.armedSectionIndex = null
    await showDetail()
    return
  }

  if (index === state.currentSectionIndex) {
    state.armedSectionIndex = index
    appendEventLog(`Hub: armed ${state.sections[index]?.name ?? 'unknown'}`)
    await updatePreview()
    return
  }

  await updateSelection(index)
}

async function handleDetailEvent(eventType: OsEventTypeList | undefined): Promise<void> {
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    state.armedSectionIndex = null
    await showDashboard()
  }
}

export function onEvenHubEvent(event: EvenHubEvent): void {
  const eventType = resolveEventType(event)
  appendEventLog(`Event: type=${String(eventType)} screen=${state.screen}`)
  appendEventLog(`Raw: ${JSON.stringify(event.jsonData ?? event.listEvent ?? event.textEvent ?? event.sysEvent ?? {})}`)

  if (state.screen === 'detail') {
    void handleDetailEvent(eventType)
    return
  }

  if (eventType === OsEventTypeList.CLICK_EVENT && (event.listEvent || event.jsonData)) {
    void handleDashboardEvent(event)
  }
}
