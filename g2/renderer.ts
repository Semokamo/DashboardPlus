import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import {
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
  LIST_WIDTH,
  STATUS_WIDTH,
  STATUS_X,
} from './layout'
import { state, bridge } from './state'
import type { HomeStatus, DeviceInfo } from './state'
import { actionsForDevice, resolveLabel } from './actions'
import * as navigation from './navigation'

// --- Rebuild helper ---

async function rebuildPage(config: {
  containerTotalNum: number
  textObject?: TextContainerProperty[]
  listObject?: ListContainerProperty[]
}): Promise<void> {
  if (!bridge) return

  if (!state.startupRendered) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    state.startupRendered = true
    return
  }

  await bridge.rebuildPageContainer(new RebuildPageContainer(config))
}

// --- Text formatters ---

function statusText(status: HomeStatus): string {
  const lines = [
    'Itsyhome',
    '',
    `${status.rooms} rooms`,
    `${status.accessories} accessories`,
    `${status.devices} services`,
  ]
  if (status.unreachable > 0) {
    lines.push(`${status.unreachable} unreachable`)
  }
  if (status.scenes > 0) {
    lines.push(`${status.scenes} scenes`)
  }
  return lines.join('\n')
}

function roomStatsText(room: string, devices: DeviceInfo[]): string {
  const lines: string[] = [room, '']

  // Temperature readings
  for (const d of devices) {
    if (d.state?.temperature !== undefined) {
      lines.push(`${d.name}: ${d.state.temperature}\u00B0C`)
    }
  }

  // Humidity readings
  for (const d of devices) {
    if (d.state?.humidity !== undefined) {
      lines.push(`${d.name}: ${d.state.humidity}%`)
    }
  }

  // Climate device status
  for (const d of devices) {
    if (d.type !== 'thermostat' && d.type !== 'heater-cooler') continue
    const s = d.state
    const parts = [d.name]
    if (s?.on !== undefined) parts.push(s.on ? 'on' : 'off')
    if (s?.mode) parts.push(s.mode)
    if (s?.targetTemperature !== undefined) parts.push(`\u2192 ${s.targetTemperature}\u00B0C`)
    lines.push(parts.join(' \u00B7 '))
  }

  lines.push('', `${devices.length} devices`)
  return lines.join('\n')
}

function deviceStateText(info: DeviceInfo): string {
  const lines: string[] = [info.name, info.type]
  if (!info.reachable) lines.push('(unreachable)')
  lines.push('')

  const s = info.state
  if (!s) {
    lines.push('No state')
    return lines.join('\n')
  }

  if (s.on !== undefined) lines.push(s.on ? 'On' : 'Off')
  if (s.brightness !== undefined) lines.push(`Brightness: ${s.brightness}%`)
  if (s.temperature !== undefined) lines.push(`${s.temperature}\u00B0C`)
  if (s.targetTemperature !== undefined) lines.push(`Target: ${s.targetTemperature}\u00B0C`)
  if (s.mode) lines.push(`Mode: ${s.mode}`)
  if (s.humidity !== undefined) lines.push(`Humidity: ${s.humidity}%`)
  if (s.position !== undefined) lines.push(`Position: ${s.position}%`)
  if (s.speed !== undefined) lines.push(`Speed: ${Math.round(s.speed)}%`)
  if (s.locked !== undefined) lines.push(s.locked ? 'Locked' : 'Unlocked')
  if (s.doorState) lines.push(`Door: ${s.doorState}`)

  return lines.join('\n')
}

// --- Dashboard screen (2 containers: room list + status) ---

export async function showDashboard(): Promise<void> {
  state.screen = 'dashboard'
  state.currentRoom = null
  state.currentDevice = null
  navigation.reset()

  if (!state.status || state.rooms.length === 0) {
    await rebuildPage({
      containerTotalNum: 1,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'loading',
          content: 'Loading home state...',
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 1,
          paddingLength: 4,
        }),
      ],
    })
    return
  }

  const roomLabels = state.rooms.map((r) => r.name)

  await rebuildPage({
    containerTotalNum: 2,
    listObject: [
      new ListContainerProperty({
        containerID: 1,
        containerName: 'rooms',
        xPosition: 0,
        yPosition: 0,
        width: LIST_WIDTH,
        height: DISPLAY_HEIGHT,
        borderWidth: 1,
        borderColor: 5,
        borderRdaius: 4,
        paddingLength: 4,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: roomLabels.length,
          itemWidth: LIST_WIDTH - 10,
          isItemSelectBorderEn: 1,
          itemName: roomLabels,
        }),
      }),
    ],
    textObject: [
      new TextContainerProperty({
        containerID: 2,
        containerName: 'status',
        content: statusText(state.status),
        xPosition: STATUS_X,
        yPosition: 0,
        width: STATUS_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 4,
      }),
    ],
  })

  appendEventLog(`Dashboard: ${state.rooms.length} rooms, ${state.status.devices} devices`)
}

// --- Device screen (2 containers: actions + state) ---

export async function showDeviceScreen(): Promise<void> {
  state.screen = 'device'

  const info = state.currentDevice
  if (!info) {
    await showDashboard()
    return
  }

  const actions = actionsForDevice(info)
  const labels = ['\u2039 Back', ...actions.map((a) => resolveLabel(a))]

  await rebuildPage({
    containerTotalNum: 2,
    listObject: [
      new ListContainerProperty({
        containerID: 1,
        containerName: 'actions',
        xPosition: 0,
        yPosition: 0,
        width: LIST_WIDTH,
        height: DISPLAY_HEIGHT,
        borderWidth: 1,
        borderColor: 5,
        borderRdaius: 4,
        paddingLength: 4,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: labels.length,
          itemWidth: LIST_WIDTH - 10,
          isItemSelectBorderEn: 1,
          itemName: labels,
        }),
      }),
    ],
    textObject: [
      new TextContainerProperty({
        containerID: 2,
        containerName: 'state',
        content: deviceStateText(info),
        xPosition: STATUS_X,
        yPosition: 0,
        width: STATUS_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 4,
      }),
    ],
  })

  appendEventLog(`Device: ${info.name} (${info.type})`)
}

// --- Menu screen ---

export async function showMenu(): Promise<void> {
  state.screen = 'menu'

  const level = navigation.current()
  if (!level) {
    await showDashboard()
    return
  }

  // Devices level: 2-container (device list + room stats)
  if (level.kind === 'devices') {
    const labels = ['\u2039 Back', ...level.devices.map((d) => d.name)]

    await rebuildPage({
      containerTotalNum: 2,
      listObject: [
        new ListContainerProperty({
          containerID: 1,
          containerName: 'devices',
          xPosition: 0,
          yPosition: 0,
          width: LIST_WIDTH,
          height: DISPLAY_HEIGHT,
          borderWidth: 1,
          borderColor: 5,
          borderRdaius: 4,
          paddingLength: 4,
          isEventCapture: 1,
          itemContainer: new ListItemContainerProperty({
            itemCount: labels.length,
            itemWidth: LIST_WIDTH - 10,
            isItemSelectBorderEn: 1,
            itemName: labels,
          }),
        }),
      ],
      textObject: [
        new TextContainerProperty({
          containerID: 2,
          containerName: 'roomstats',
          content: roomStatsText(level.room, level.devices),
          xPosition: STATUS_X,
          yPosition: 0,
          width: STATUS_WIDTH,
          height: DISPLAY_HEIGHT,
          isEventCapture: 0,
          paddingLength: 4,
        }),
      ],
    })
    return
  }

  // Actions level: full-width list
  const labels = ['\u2039 Back', ...level.items.map((item) => resolveLabel(item))]

  await rebuildPage({
    containerTotalNum: 1,
    listObject: [
      new ListContainerProperty({
        containerID: 1,
        containerName: 'menu',
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        borderWidth: 1,
        borderColor: 5,
        borderRdaius: 4,
        paddingLength: 4,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: labels.length,
          itemWidth: DISPLAY_WIDTH - 10,
          isItemSelectBorderEn: 1,
          itemName: labels,
        }),
      }),
    ],
  })
}

// --- Loading screen ---

export async function showLoading(label: string): Promise<void> {
  state.screen = 'loading'

  await rebuildPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'loading',
        content: `Sending: ${label}...`,
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 4,
      }),
    ],
  })
}

// --- Confirmation screen ---

export async function showConfirmation(message: string): Promise<void> {
  state.screen = 'confirmation'
  state.confirmationMessage = message

  await rebuildPage({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'confirmation',
        content: message,
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 1,
        paddingLength: 4,
      }),
    ],
  })
}
