import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  Card,
  CardHeader,
  CardContent,
  Text,
  Button,
} from '@jappyjan/even-realities-ui'
import { refreshState } from './hub-app'

function OverviewPanel() {
  const handleRefresh = () => {
    void refreshState()
  }

  const handleConnect = () => {
    document.getElementById('connectBtn')?.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Card style={{ width: '100%' }}>
        <CardHeader>
          <Text variant="title-1">DashboardPlus</Text>
          <Text variant="body-2" style={{ color: 'var(--color-tc-2)', marginTop: '4px', display: 'block' }}>
            A glasses dashboard shell built from the current Even G2 layout.
          </Text>
        </CardHeader>
        <CardContent>
          <Text variant="body-2">
            Left side: Telegram, AI, News
          </Text>
          <Text variant="body-2">
            Right side: placeholder preview text for the selected section
          </Text>
        </CardContent>
      </Card>
      <Card style={{ width: '100%' }}>
        <CardHeader>
          <Text variant="title-1">Controls</Text>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button variant="primary" style={{ width: '100%' }} onClick={handleConnect}>
            Connect DashboardPlus
          </Button>
          <Button variant="default" style={{ width: '100%' }} onClick={handleRefresh}>
            Reload static sections
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function initUI(): void {
  const app = document.getElementById('app')
  if (!app) return

  for (const id of ['actionBtn']) {
    const el = document.getElementById(id)
    if (el) el.remove()
  }

  const connectBtn = document.getElementById('connectBtn')
  if (connectBtn) connectBtn.style.display = 'none'
  const eventLog = document.getElementById('event-log')
  if (eventLog) {
    eventLog.removeAttribute('hidden')
    eventLog.setAttribute(
      'style',
      'margin: 24px 0 0; white-space: pre-wrap; max-height: 240px; overflow: auto; font-size: 12px;',
    )
  }

  const heading = app.querySelector('h1')
  const status = document.getElementById('status')
  if (heading) app.appendChild(heading)
  if (status) app.appendChild(status)

  const container = document.createElement('div')
  container.style.margin = '48px 0'
  app.insertBefore(container, heading)

  createRoot(container).render(
    <React.StrictMode>
      <OverviewPanel />
    </React.StrictMode>,
  )
}
