import { createHomeActions } from './main'
import type { AppModule } from '../_shared/app-types'

export const app: AppModule = {
  id: 'itsyhome',
  name: 'Itsyhome',
  pageTitle: 'Settings',
  connectLabel: 'Connect Itsyhome',
  actionLabel: 'Refresh',
  initialStatus: 'Itsyhome ready',
  createActions: createHomeActions,
}

export default app
