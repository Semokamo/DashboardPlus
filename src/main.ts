import type { AppModule } from '../_shared/app-types'

function updateStatus(text: string) {
  console.log(`[ui] ${text}`)
  const el = document.getElementById('status')
  if (el) el.textContent = text
}

async function boot() {
  const module = await import('../g2/index')
  const app: AppModule = module.app ?? module.default

  const heading = document.querySelector('#app h1')
  const actionBtn = document.getElementById('actionBtn') as HTMLButtonElement | null

  if (heading) heading.textContent = app.pageTitle ?? `Even Hub ${app.name} App`
  if (actionBtn) actionBtn.textContent = app.actionLabel ?? `${app.name} Action`

  document.title = `${app.name} \u2013 Even G2`
  updateStatus(app.initialStatus ?? `${app.name} app ready`)

  const actions = await app.createActions(updateStatus)
  let isRunningAction = false

  try {
    await actions.connect()
  } catch (error) {
    console.error('[app-loader] auto-connect failed', error)
    updateStatus('Connect failed')
  }

  actionBtn?.addEventListener('click', async () => {
    if (isRunningAction) return
    isRunningAction = true
    if (actionBtn) actionBtn.disabled = true

    try {
      await actions.action()
    } catch (error) {
      console.error('[app-loader] action failed', error)
      updateStatus('Action failed')
    } finally {
      isRunningAction = false
      if (actionBtn) actionBtn.disabled = false
    }
  })
}

void boot().catch((error) => {
  console.error('[app-loader] boot failed', error)
  updateStatus('App boot failed')
})
