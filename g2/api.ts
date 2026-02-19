import type { HomeStatus, Room, DeviceInfo } from './state'

const SERVER_URL_KEY = 'itsyhome:server-url'
const DEFAULT_URL = 'http://localhost:8423'

function getBaseUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) ?? DEFAULT_URL
}

export function setBaseUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url)
}

export async function getStatus(): Promise<HomeStatus> {
  const res = await fetch(`${getBaseUrl()}/status`)
  if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`)
  return await res.json()
}

export async function getRooms(): Promise<Room[]> {
  const res = await fetch(`${getBaseUrl()}/list/rooms`)
  if (!res.ok) throw new Error(`Rooms fetch failed: ${res.status}`)
  return await res.json()
}

export async function getRoomDevices(room: string): Promise<DeviceInfo[]> {
  const res = await fetch(`${getBaseUrl()}/info/${encodeURIComponent(room)}`)
  if (!res.ok) throw new Error(`Room devices fetch failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : [data]
}

export async function getDeviceInfo(room: string, device: string): Promise<DeviceInfo> {
  const res = await fetch(`${getBaseUrl()}/info/${encodeURIComponent(room)}/${encodeURIComponent(device)}`)
  if (!res.ok) throw new Error(`Device info fetch failed: ${res.status}`)
  return await res.json()
}

export async function sendAction(path: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl()}/${path}`)
    const data = await res.json()
    if (data.status === 'success' || data.status === 'partial') {
      return { ok: true }
    }
    return { ok: false, error: data.message ?? `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function checkConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/status`, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}
