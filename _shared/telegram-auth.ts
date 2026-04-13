const SNAPSHOT_KEY = 'dashboardplus:telegram-snapshot'
export const TELEGRAM_AUTH_EVENT = 'dashboardplus:telegram-auth-changed'

export type TelegramAuthSnapshot = {
  loggedIn: boolean
  userLabel: string | null
}

export type TelegramDialogKind = 'channels' | 'chats' | 'groups'

export type TelegramDialogItem = {
  id: string
  title: string
  updatedAt: string | null
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function emitAuthChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TELEGRAM_AUTH_EVENT, { detail: getTelegramAuthSnapshot() }))
}

function storeSnapshot(snapshot: TelegramAuthSnapshot): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
}

function clearSnapshot(): void {
  if (!canUseStorage()) return
  window.localStorage.removeItem(SNAPSHOT_KEY)
}

function normalizeSnapshot(value: Partial<TelegramAuthSnapshot> | null | undefined): TelegramAuthSnapshot {
  return {
    loggedIn: Boolean(value?.loggedIn),
    userLabel: value?.userLabel ?? null,
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string; message?: string }
  if (!response.ok) {
    throw new Error(data.error ?? data.message ?? `Request failed with status ${response.status}`)
  }
  return data
}

async function postJson<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })

  return readJson<T>(response)
}

function applySnapshot(snapshot: TelegramAuthSnapshot): TelegramAuthSnapshot {
  const normalized = normalizeSnapshot(snapshot)
  if (normalized.loggedIn) {
    storeSnapshot(normalized)
  } else {
    clearSnapshot()
  }
  emitAuthChanged()
  return normalized
}

export function getTelegramAuthSnapshot(): TelegramAuthSnapshot {
  if (!canUseStorage()) {
    return { loggedIn: false, userLabel: null }
  }

  const raw = window.localStorage.getItem(SNAPSHOT_KEY)
  if (!raw) {
    return { loggedIn: false, userLabel: null }
  }

  try {
    return normalizeSnapshot(JSON.parse(raw) as Partial<TelegramAuthSnapshot>)
  } catch {
    clearSnapshot()
    return { loggedIn: false, userLabel: null }
  }
}

export function isTelegramLoggedIn(): boolean {
  return getTelegramAuthSnapshot().loggedIn
}

export async function restoreTelegramSession(): Promise<TelegramAuthSnapshot> {
  try {
    const response = await fetch('/api/telegram/status')
    const data = await readJson<{ snapshot: TelegramAuthSnapshot }>(response)
    return applySnapshot(data.snapshot)
  } catch {
    return applySnapshot({ loggedIn: false, userLabel: null })
  }
}

export type TelegramLoginResult =
  | {
      status: 'code_required'
      message?: string
    }
  | {
      status: 'password_required'
      message?: string
    }
  | {
      status: 'logged_in'
      snapshot: TelegramAuthSnapshot
      message?: string
    }

function toLoginResult(payload: {
  status: 'code_required' | 'password_required' | 'logged_in'
  snapshot?: TelegramAuthSnapshot
  userLabel?: string | null
  message?: string
}): TelegramLoginResult {
  if (payload.status === 'logged_in') {
    return {
      status: 'logged_in',
      snapshot: applySnapshot({
        loggedIn: true,
        userLabel: payload.snapshot?.userLabel ?? payload.userLabel ?? null,
      }),
      message: payload.message,
    }
  }

  return {
    status: payload.status,
    message: payload.message,
  }
}

export async function startTelegramLogin(phoneNumber: string): Promise<TelegramLoginResult> {
  const data = await postJson<{
    status: 'code_required' | 'password_required' | 'logged_in'
    snapshot?: TelegramAuthSnapshot
    userLabel?: string | null
    message?: string
  }>('/api/telegram/start-login', { phoneNumber })

  return toLoginResult(data)
}

export async function submitTelegramCode(code: string): Promise<TelegramLoginResult> {
  const data = await postJson<{
    status: 'code_required' | 'password_required' | 'logged_in'
    snapshot?: TelegramAuthSnapshot
    userLabel?: string | null
    message?: string
  }>('/api/telegram/submit-code', { code })

  return toLoginResult(data)
}

export async function submitTelegramPassword(password: string): Promise<TelegramLoginResult> {
  const data = await postJson<{
    status: 'code_required' | 'password_required' | 'logged_in'
    snapshot?: TelegramAuthSnapshot
    userLabel?: string | null
    message?: string
  }>('/api/telegram/submit-password', { password })

  return toLoginResult(data)
}

export async function logoutTelegram(): Promise<void> {
  await postJson<{ ok: true }>('/api/telegram/logout')
  applySnapshot({ loggedIn: false, userLabel: null })
}

export async function fetchTelegramDialogs(kind: TelegramDialogKind): Promise<TelegramDialogItem[]> {
  const response = await fetch(`/api/telegram/dialogs?kind=${encodeURIComponent(kind)}`)
  const data = await readJson<{ items: TelegramDialogItem[] }>(response)
  return data.items
}
