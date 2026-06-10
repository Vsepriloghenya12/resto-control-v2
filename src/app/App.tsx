import { SessionProvider, useSession } from './providers/SessionProvider'
import { AuthPage } from '../pages/auth/AuthPage'
import { OwnerDashboardPage } from '../pages/owner-dashboard/OwnerDashboardPage'
import { EmployeeStartPage } from '../pages/employee-start/EmployeeStartPage'
import { ServiceOwnerPage } from '../pages/service-owner/ServiceOwnerPage'
import '../pages/service-owner/ServiceOwnerPage.css'

function AppContent() {
  const { session } = useSession()

  if (!session) {
    return <AuthPage />
  }

  if (session.membership.role === 'service_owner') {
    return <ServiceOwnerPage />
  }

  if (session.membership.role === 'owner' || session.membership.role === 'manager') {
    return <OwnerDashboardPage />
  }

  return <EmployeeStartPage />
}

export function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  )
}
