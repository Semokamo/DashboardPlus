import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type HubSection = {
  name: string
  preview: string
}

export type Screen = 'dashboard' | 'detail' | 'loading'
export type TelegramDialogKind = 'channels' | 'chats' | 'groups'
export type TelegramView = 'root' | 'list'

export type TelegramDialogItem = {
  id: string
  title: string
  updatedAt: string | null
}

export type State = {
  screen: Screen
  startupRendered: boolean
  sections: HubSection[]
  currentSectionIndex: number
  armedSectionIndex: number | null
  telegramView: TelegramView
  telegramListKind: TelegramDialogKind | null
  telegramItems: TelegramDialogItem[]
}

export const state: State = {
  screen: 'dashboard',
  startupRendered: false,
  sections: [],
  currentSectionIndex: 0,
  armedSectionIndex: null,
  telegramView: 'root',
  telegramListKind: null,
  telegramItems: [],
}

export let bridge: EvenAppBridge | null = null

export function setBridge(value: EvenAppBridge): void {
  bridge = value
}

export function currentSection(): HubSection | null {
  return state.sections[state.currentSectionIndex] ?? null
}

export function resetTelegramState(): void {
  state.telegramView = 'root'
  state.telegramListKind = null
  state.telegramItems = []
}
