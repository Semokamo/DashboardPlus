import { createHomeActions } from './main'
import type { AppModule } from '../_shared/app-types'

export const app: AppModule = {
  id: 'dashboardplus',
  name: 'DashboardPlus',
  pageTitle: 'DashboardPlus',
  connectLabel: 'Connect DashboardPlus',
  actionLabel: 'Reload',
  initialStatus: 'DashboardPlus ready',
  createActions: createHomeActions,
}

export default app
