import { useEffect, useState } from 'react'
import { SessionProvider, useSession } from './providers/SessionProvider'
import { AuthPage } from '../pages/auth/AuthPage'
import { OwnerDashboardPage } from '../pages/owner-dashboard/OwnerDashboardPage'
import { EmployeeStartPage } from '../pages/employee-start/EmployeeStartPage'
import { ServiceOwnerPage } from '../pages/service-owner/ServiceOwnerPage'
import '../pages/service-owner/ServiceOwnerPage.css'

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 820px)').matches)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 820px)')
    const sync = () => setIsMobile(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return isMobile
}

function AppContent() {
  const { session, isLoading } = useSession()
  const isMobile = useMobileViewport()

  if (isLoading) {
    return <main className="app-loading">Загрузка...</main>
  }

  if (!session) {
    return <AuthPage />
  }

  if (session.membership.role === 'service_owner') {
    return <ServiceOwnerPage />
  }

  if (session.membership.role === 'manager') {
    return isMobile ? <EmployeeStartPage /> : <OwnerDashboardPage />
  }

  if (session.membership.role === 'owner') {
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
