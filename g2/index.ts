import { createHomeActions } from './main'
import type { AppModule } from '../_shared/app-types'

export const app: AppModule = {
  id: 'itsyhome',
  name: 'itsyhome',
  pageTitle: 'Settings',
  connectLabel: 'Connect itsyhome',
  actionLabel: 'Refresh',
  initialStatus: 'itsyhome ready',
  createActions: createHomeActions,
}

export default app
