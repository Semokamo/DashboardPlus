import type { ActionItem } from './actions'
import type { DeviceInfo } from './state'

export type MenuLevel =
  | { kind: 'devices'; room: string; devices: DeviceInfo[] }
  | { kind: 'actions'; label: string; items: ActionItem[] }

const stack: MenuLevel[] = []

export function push(level: MenuLevel): void {
  stack.push(level)
}

export function pop(): MenuLevel | undefined {
  stack.pop()
  return current()
}

export function current(): MenuLevel | undefined {
  return stack[stack.length - 1]
}

export function reset(): void {
  stack.length = 0
}

export function depth(): number {
  return stack.length
}
