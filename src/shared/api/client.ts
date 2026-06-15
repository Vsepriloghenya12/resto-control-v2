export type ApiList<T> = { items: T[] }

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const rawText = contentType.includes('application/json') ? '' : await response.text().catch(() => '')
  const data = contentType.includes('application/json') ? await response.json().catch(() => null) : null

  if (!response.ok) {
    if (data?.message) throw new Error(data.message)
    if (rawText.trim().startsWith('<')) throw new Error('Сервер вернул HTML вместо JSON. Проверьте API-адрес и деплой backend.')
    throw new Error(rawText.trim() || 'Не удалось выполнить действие.')
  }

  return data as T
}

export const api = {
  list<T>(resource: string) {
    return apiRequest<ApiList<T>>(`/api/${resource}`)
  },
  create<T>(resource: string, payload: unknown) {
    return apiRequest<T>(`/api/${resource}`, { method: 'POST', body: JSON.stringify(payload) })
  },
  update<T>(resource: string, id: string, payload: unknown) {
    return apiRequest<T>(`/api/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  remove(resource: string, id: string) {
    return apiRequest<{ ok: true }>(`/api/${resource}/${id}`, { method: 'DELETE' })
  },
  bookingStatus<T>(id: string, status: string) {
    return apiRequest<T>(`/api/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  },
}
