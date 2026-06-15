import type { AuthSession, LoginPayload, RegisterRestaurantPayload } from './authTypes'

const API_URL = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const rawText = isJson ? '' : await response.text().catch(() => '')
  const data = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    if (data?.message) throw new Error(data.message)
    if (rawText.trim().startsWith('<')) throw new Error('Сервер вернул HTML вместо JSON. Проверьте API-адрес и деплой backend.')
    throw new Error(rawText.trim() || 'Не удалось выполнить запрос. Попробуйте ещё раз.')
  }

  return data as T
}

export const authApi = {
  login(payload: LoginPayload) {
    return request<AuthSession>('/api/auth/login', payload)
  },
  registerRestaurant(payload: RegisterRestaurantPayload) {
    return request<AuthSession>('/api/auth/register-restaurant', payload)
  },
  me() {
    return request<AuthSession>('/api/auth/me')
  },
  logout() {
    return request<{ ok: true }>('/api/auth/logout', {})
  },
}
