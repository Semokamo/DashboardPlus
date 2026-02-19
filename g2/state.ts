import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type DeviceState = {
  on?: boolean
  brightness?: number
  position?: number
  temperature?: number
  targetTemperature?: number
  mode?: string
  humidity?: number
  hue?: number
  saturation?: number
  locked?: boolean
  doorState?: string
  speed?: number
}

export type DeviceInfo = {
  name: string
  type: string
  icon: string
  reachable: boolean
  room?: string
  state?: DeviceState
}

export type HomeStatus = {
  rooms: number
  devices: number
  accessories: number
  reachable: number
  unreachable: number
  scenes: number
  groups: number
}

export type Room = {
  name: string
}

export type Screen = 'dashboard' | 'menu' | 'device' | 'loading' | 'confirmation'

export type State = {
  screen: Screen
  startupRendered: boolean
  status: HomeStatus | null
  rooms: Room[]
  currentRoom: string | null
  currentDevice: DeviceInfo | null
  confirmationMessage: string
}

export const state: State = {
  screen: 'dashboard',
  startupRendered: false,
  status: null,
  rooms: [],
  currentRoom: null,
  currentDevice: null,
  confirmationMessage: '',
}

export let bridge: EvenAppBridge | null = null

export function setBridge(b: EvenAppBridge): void {
  bridge = b
}
