import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '../../features/auth/authApi'
import type { AuthSession, LoginPayload, RegisterRestaurantPayload } from '../../features/auth/authTypes'

type SessionContextValue = {
  session: AuthSession | null
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<AuthSession>
  registerRestaurant: (payload: RegisterRestaurantPayload) => Promise<AuthSession>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    authApi.me()
      .then((nextSession) => {
        if (active) setSession(nextSession)
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const value = useMemo<SessionContextValue>(() => ({
    session,
    isLoading,
    async login(payload) {
      const nextSession = await authApi.login(payload)
      setSession(nextSession)
      return nextSession
    },
    async registerRestaurant(payload) {
      const nextSession = await authApi.registerRestaurant(payload)
      setSession(nextSession)
      return nextSession
    },
    async logout() {
      try {
        await authApi.logout()
      } finally {
        setSession(null)
      }
    },
  }), [isLoading, session])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used inside SessionProvider')
  }
  return context
}
