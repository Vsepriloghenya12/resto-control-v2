export type User = {
  id: string
  name: string
  login: string
}

export type Restaurant = {
  id: string
  name: string
  plan?: string
  subscriptionStatus?: 'trial' | 'active' | 'payment_pending' | 'expired'
  trialStartedAt?: string
  trialEndsAt?: string
  subscriptionEndsAt?: string
}

export type MembershipRole = 'service_owner' | 'owner' | 'manager' | 'senior' | 'employee'

export type Membership = {
  id: string
  userId: string
  restaurantId: string
  role: MembershipRole
  status: 'active' | 'invited' | 'blocked'
}

export type AuthSession = {
  token: string
  user: User
  restaurant: Restaurant
  membership: Membership
}

export type LoginPayload = {
  login: string
  password: string
  remember: boolean
}

export type RegisterRestaurantPayload = {
  restaurantName: string
  ownerName: string
  login: string
  password: string
}
