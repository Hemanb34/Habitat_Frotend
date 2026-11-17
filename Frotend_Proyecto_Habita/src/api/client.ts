/**
 * Cliente HTTP centralizado para comunicar el Frontend (React/Vite)
 * con el Backend Principal de Habita (FastAPI en el puerto 8000).
 */

import {
  AdminDashboardResponse,
  CatalogResponse,
  CatalogSortOrder,
  CrawlerRunResponse,
  LoginRequest,
  MarginCalculationRequest,
  ModelRetrainResponse,
  PricingRecommendation,
  PropertyEstimateRequest,
  PropertyEstimateResponse,
  TokenResponse,
} from '../types'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = sessionStorage.getItem('habita_admin_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? typeof payload.detail === 'string'
          ? payload.detail
          : JSON.stringify(payload.detail)
        : `Error HTTP ${response.status}`
    throw new ApiError(response.status, detail, payload)
  }

  return payload as T
}

export interface HealthResponse {
  status: string
  service: string
  database: string
  db_name: string
}

export function checkBackendHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health')
}

export interface FetchCatalogParams {
  comuna?: string
  tipo_inmueble?: string
  ordenar_por?: CatalogSortOrder
  limit?: number
  offset?: number
}

export function fetchCatalogProperties(
  params: FetchCatalogParams = {}
): Promise<CatalogResponse> {
  const searchParams = new URLSearchParams()

  if (params.comuna && params.comuna !== 'Todos') {
    searchParams.set('comuna', params.comuna)
  }
  if (params.tipo_inmueble && params.tipo_inmueble !== 'Todos') {
    searchParams.set('tipo_inmueble', params.tipo_inmueble)
  }
  if (params.ordenar_por) {
    searchParams.set('ordenar_por', params.ordenar_por)
  }
  if (params.limit) {
    searchParams.set('limit', String(params.limit))
  }
  if (params.offset) {
    searchParams.set('offset', String(params.offset))
  }

  const query = searchParams.toString()
  return apiFetch<CatalogResponse>(`/properties${query ? `?${query}` : ''}`)
}

export function estimatePropertyPrice(
  payload: PropertyEstimateRequest
): Promise<PropertyEstimateResponse> {
  return apiFetch<PropertyEstimateResponse>('/properties/estimate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function calculateMarginByStrategy(
  payload: MarginCalculationRequest
): Promise<PricingRecommendation> {
  return apiFetch<PricingRecommendation>('/properties/margin', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function loginAdmin(payload: LoginRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function logoutAdmin(): Promise<{ status: string; username: string }> {
  return apiFetch<{ status: string; username: string }>('/auth/logout', {
    method: 'POST',
  })
}

export function unlockAdminAccount(): Promise<{ status: string; username: string }> {
  return apiFetch<{ status: string; username: string }>('/auth/unlock', {
    method: 'POST',
  })
}

export function fetchAdminDashboard(): Promise<AdminDashboardResponse> {
  return apiFetch<AdminDashboardResponse>('/admin/dashboard')
}

export function runAdminCrawlers(portal?: string | null): Promise<CrawlerRunResponse> {
  return apiFetch<CrawlerRunResponse>('/admin/crawlers/run', {
    method: 'POST',
    body: JSON.stringify({ portal: portal || null, max_pages: 1 }),
  })
}

export function runAdminModelRetrain(): Promise<ModelRetrainResponse> {
  return apiFetch<ModelRetrainResponse>('/admin/ml/retrain', {
    method: 'POST',
  })
}
