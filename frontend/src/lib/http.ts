import { API_BASE_URL } from '../config'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

const normalizeBody = (body: unknown) => {
  if (!body || typeof body !== 'object') return undefined
  const form = new URLSearchParams()
  Object.entries(body as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    form.append(key, String(value))
  })
  return form
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function http<T>(
  path: string,
  options?: {
    method?: HttpMethod
    token?: string | null
    body?: unknown
    query?: Record<string, string | number | undefined | null>
  },
): Promise<T> {
  const method = options?.method ?? 'GET'
  const query = options?.query
    ? `?${new URLSearchParams(
        Object.entries(options.query)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)]),
      ).toString()}`
    : ''

  const url = `${API_BASE_URL}${path}${query}`
  const headers: Record<string, string> = {}
  if (options?.token) headers.Authorization = `Bearer ${options.token}`

  let body: BodyInit | undefined
  if (options?.body) {
    body = normalizeBody(options.body)
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
  })

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const message =
      (data as { detail?: string } | null)?.detail ??
      `Erro ${res.status} ao acessar a API`
    throw new ApiError(message, res.status)
  }

  return data as T
}
