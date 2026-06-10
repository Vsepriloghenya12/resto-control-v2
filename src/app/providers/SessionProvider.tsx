import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthSession, LoginPayload, RegisterRestaurantPayload } from '../../features/auth/authTypes'

type SessionContextValue = {
  session: AuthSession | null
  login: (payload: LoginPayload) => Promise<AuthSession>
  registerRestaurant: (payload: RegisterRestaurantPayload) => Promise<AuthSession>
  logout: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString()
}

function createLocalSession(role: AuthSession['membership']['role']): AuthSession {
  const now = new Date()
  const isOwner = role === 'owner' || role === 'manager'

  return {
    token: 'local-session-token',
    user: {
      id: 'user_local',
      name: role === 'service_owner' ? 'Владелец сервиса' : role === 'owner' ? 'Владелец' : 'Сотрудник',
      login: role === 'service_owner' ? 'admin@resto.local' : role === 'owner' ? 'owner@resto.local' : 'employee@resto.local',
    },
    restaurant: {
      id: 'restaurant_local',
      name: 'Resto Control',
      plan: isOwner ? 'standard' : 'trial',
      subscriptionStatus: isOwner ? 'active' : 'trial',
      trialStartedAt: now.toISOString(),
      trialEndsAt: addDays(now, 14),
      subscriptionEndsAt: isOwner ? addDays(now, 5) : undefined,
    },
    membership: {
      id: 'membership_local',
      restaurantId: 'restaurant_local',
      userId: 'user_local',
      role,
      status: 'active',
    },
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)

  const value = useMemo<SessionContextValue>(() => ({
    session,
    async login(payload) {
      const login = payload.login.toLowerCase()
      const role = login.includes('admin') || login.includes('super') || login.includes('service') || login.includes('platform') ? 'service_owner' : login.includes('owner') || login.includes('владел') ? 'owner' : 'employee'
      const nextSession = createLocalSession(role)
      setSession(nextSession)
      return nextSession
    },
    async registerRestaurant(payload) {
      const nextSession = createLocalSession('owner')
      nextSession.restaurant.name = payload.restaurantName
      nextSession.user.name = payload.ownerName
      nextSession.user.login = payload.login
      setSession(nextSession)
      return nextSession
    },
    logout() {
      setSession(null)
    },
  }), [session])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used inside SessionProvider')
  }
  return context
}
