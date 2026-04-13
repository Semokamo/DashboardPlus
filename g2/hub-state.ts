import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type HubSection = {
  name: string
  preview: string
}

export type Screen = 'dashboard' | 'loading'

export type State = {
  screen: Screen
  startupRendered: boolean
  sections: HubSection[]
  currentSectionIndex: number
}

export const state: State = {
  screen: 'dashboard',
  startupRendered: false,
  sections: [],
  currentSectionIndex: 0,
}

export let bridge: EvenAppBridge | null = null

export function setBridge(value: EvenAppBridge): void {
  bridge = value
}

export function currentSection(): HubSection | null {
  return state.sections[state.currentSectionIndex] ?? null
}
