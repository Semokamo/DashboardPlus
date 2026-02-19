import type { DeviceInfo } from './state'

export type SimpleAction = {
  type: 'command'
  label: string
  path: string
}

export type ToggleAction = {
  type: 'toggle'
  onLabel: string
  offLabel: string
  onPath: string
  offPath: string
  isOn: boolean
}

export type SubMenuAction = {
  type: 'submenu'
  label: string
  children: ActionItem[]
}

export type RefreshAction = {
  type: 'refresh'
  label: string
}

export type ActionItem = SimpleAction | ToggleAction | SubMenuAction | RefreshAction

export function resolveLabel(item: ActionItem): string {
  switch (item.type) {
    case 'toggle':
      return item.isOn ? item.onLabel : item.offLabel
    case 'submenu':
    case 'command':
    case 'refresh':
      return item.label
  }
}

export function resolvePath(item: ActionItem): string | null {
  switch (item.type) {
    case 'toggle':
      return item.isOn ? item.onPath : item.offPath
    case 'command':
      return item.path
    case 'submenu':
    case 'refresh':
      return null
  }
}

function targetPath(room: string, device: string): string {
  return `${encodeURIComponent(room)}/${encodeURIComponent(device)}`
}

function brightnessPresets(room: string, device: string): ActionItem[] {
  const target = targetPath(room, device)
  return [10, 25, 50, 75, 100].map((b) => ({
    type: 'command' as const,
    label: `${b}%`,
    path: `brightness/${b}/${target}`,
  }))
}

function positionPresets(room: string, device: string): ActionItem[] {
  const target = targetPath(room, device)
  return [0, 25, 50, 75, 100].map((p) => ({
    type: 'command' as const,
    label: `${p}%`,
    path: `position/${p}/${target}`,
  }))
}

function speedPresets(room: string, device: string): ActionItem[] {
  const target = targetPath(room, device)
  return [0, 25, 50, 75, 100].map((s) => ({
    type: 'command' as const,
    label: `${s}%`,
    path: `speed/${s}/${target}`,
  }))
}

function temperaturePresets(room: string, device: string): ActionItem[] {
  const target = targetPath(room, device)
  return Array.from({ length: 13 }, (_, i) => 16 + i).map((t) => ({
    type: 'command' as const,
    label: `${t}\u00B0C`,
    path: `temp/${t}/${target}`,
  }))
}

function colourPresets(room: string, device: string): ActionItem[] {
  const target = targetPath(room, device)
  const colours = [
    { label: 'Warm white', hue: 30, sat: 30 },
    { label: 'Cool white', hue: 210, sat: 10 },
    { label: 'Red', hue: 0, sat: 100 },
    { label: 'Orange', hue: 30, sat: 100 },
    { label: 'Yellow', hue: 60, sat: 100 },
    { label: 'Green', hue: 120, sat: 100 },
    { label: 'Blue', hue: 240, sat: 100 },
    { label: 'Purple', hue: 270, sat: 100 },
    { label: 'Pink', hue: 330, sat: 100 },
  ]
  return colours.map((c) => ({
    type: 'command' as const,
    label: c.label,
    path: `color/${c.hue}/${c.sat}/${target}`,
  }))
}

function powerToggle(room: string, device: string, isOn: boolean): ToggleAction {
  const target = targetPath(room, device)
  return {
    type: 'toggle',
    onLabel: 'Turn off',
    offLabel: 'Turn on',
    onPath: `off/${target}`,
    offPath: `on/${target}`,
    isOn,
  }
}

export function actionsForDevice(info: DeviceInfo): ActionItem[] {
  const room = info.room ?? ''
  const device = info.name
  const target = targetPath(room, device)
  const items: ActionItem[] = []
  const s = info.state

  switch (info.type) {
    case 'light':
      items.push(powerToggle(room, device, s?.on ?? false))
      if (s?.brightness !== undefined) {
        items.push({ type: 'submenu', label: 'Brightness \u203A', children: brightnessPresets(room, device) })
      }
      if (s?.hue !== undefined) {
        items.push({ type: 'submenu', label: 'Colour \u203A', children: colourPresets(room, device) })
      }
      break

    case 'switch':
    case 'outlet':
      items.push(powerToggle(room, device, s?.on ?? false))
      break

    case 'fan':
      items.push(powerToggle(room, device, s?.on ?? false))
      if (s?.speed !== undefined) {
        items.push({ type: 'submenu', label: 'Speed \u203A', children: speedPresets(room, device) })
      }
      break

    case 'thermostat':
    case 'heater-cooler':
      items.push(powerToggle(room, device, s?.on ?? false))
      items.push({ type: 'submenu', label: 'Temperature \u203A', children: temperaturePresets(room, device) })
      break

    case 'blinds':
      items.push({ type: 'command', label: 'Open', path: `open/${target}` })
      items.push({ type: 'command', label: 'Close', path: `close/${target}` })
      items.push({ type: 'submenu', label: 'Position \u203A', children: positionPresets(room, device) })
      break

    case 'lock':
      items.push({
        type: 'toggle',
        onLabel: 'Unlock',
        offLabel: 'Lock',
        onPath: `unlock/${target}`,
        offPath: `lock/${target}`,
        isOn: s?.locked ?? false,
      })
      break

    case 'garage-door':
      items.push({ type: 'command', label: 'Open', path: `open/${target}` })
      items.push({ type: 'command', label: 'Close', path: `close/${target}` })
      break

    case 'temperature-sensor':
    case 'humidity-sensor':
      break

    default:
      if (s?.on !== undefined) {
        items.push(powerToggle(room, device, s.on))
      }
      break
  }

  return items
}
