import { useEffect, useState } from 'react'
import { SessionProvider, useSession } from './providers/SessionProvider'
import { AuthPage } from '../pages/auth/AuthPage'
import { OwnerDashboardPage } from '../pages/owner-dashboard/OwnerDashboardPage'
import { EmployeeStartPage } from '../pages/employee-start/EmployeeStartPage'
import { ServiceOwnerPage } from '../pages/service-owner/ServiceOwnerPage'
import { useTheme } from '../shared/hooks/useTheme'
import '../pages/service-owner/ServiceOwnerPage.css'
import '../shared/styles/dark-theme.css'

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

function AppContent({ onThemeToggle, theme }: { onThemeToggle: () => void; theme: string }) {
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

  if (session.membership.role === 'manager' || session.membership.role === 'support') {
    return isMobile ? <EmployeeStartPage /> : <OwnerDashboardPage onThemeToggle={onThemeToggle} theme={theme} />
  }

  if (session.membership.role === 'owner') {
    return <OwnerDashboardPage onThemeToggle={onThemeToggle} theme={theme} />
  }

  return <EmployeeStartPage />
}

export function App() {
  const { toggle, theme } = useTheme()
  return (
    <SessionProvider>
      <AppContent onThemeToggle={toggle} theme={theme} />
    </SessionProvider>
  )
}
