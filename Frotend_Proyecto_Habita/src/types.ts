export type Page = 'landing' | 'arrendatario' | 'propietario' | 'admin-login' | 'admin-dashboard'

export type CatalogSortOrder = 'mejor-oferta' | 'menor-precio' | 'mayor-area'

export interface CatalogInitialFilters {
  comuna?: string
  type?: string
}

export type NavigateFn = (page: Page, filters?: CatalogInitialFilters) => void

export interface Property {
  id: number
  title: string
  comuna: string
  barrio?: string | null
  tipo_inmueble: string
  area: number
  habitaciones: number
  banos: number
  parqueaderos: number
  estrato: number
  precio_publicado: number
  precio_estimado: number
  portal: string
  imagen_url: string | null
  url_origen: string
  amoblado: boolean
  incluye_administracion: boolean
  valor_administracion?: number | null
  diferencia_pct: number
  etiqueta_oferta: string
}

export interface CatalogResponse {
  total: number
  comunas_disponibles: string[]
  tipos_disponibles: string[]
  items: Property[]
}

export interface PropertyEstimateRequest {
  comuna: string
  barrio?: string | null
  tipo_inmueble: string
  area: number
  estrato: number
  habitaciones: number
  banos: number
  parqueaderos: number
  amoblado?: boolean
  incluye_administracion?: boolean
}

export interface CompetitorItem {
  id: number
  title: string
  comuna: string
  tipo_inmueble: string
  estrato: number
  area: number
  habitaciones: number
  banos: number
  parqueaderos: number
  precio_publicado: number
  portal: string
  url_origen: string
  diferencia_vs_estimado_pct: number
}

export interface MarketMetrics {
  total_competidores: number
  precio_minimo: number
  precio_promedio: number
  precio_maximo: number
  rango_area_min_rn03: number
  rango_area_max_rn03: number
}

export type PricingStrategyKey = 'liquidez' | 'balanceada' | 'rentabilidad'

export interface PricingRecommendation {
  clave: PricingStrategyKey
  nombre_estrategia: string
  objetivo_comercial: string
  precio_sugerido: number
  limite_inferior: number
  limite_superior: number
  ajuste_aplicado_pct: number
  explicacion: string
}

export interface MarginCalculationRequest {
  estrategia: PricingStrategyKey
  precio_base_estimado: number
  metricas_mercado: MarketMetrics
}

export interface PropertyEstimateResponse {
  precio_estimado: number
  precio_m2_estimado: number
  modelo_utilizado: string
  version_modelo: string
  mape_modelo_pct: number
  umbral_rn01_pct: number
  metricas_mercado: MarketMetrics
  competidores: CompetitorItem[]
  rango_sugerido_inferior: number
  rango_sugerido_superior: number
  estrategias_comerciales: Record<PricingStrategyKey, PricingRecommendation>
}

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  username: string
  rol: string
  expires_in_minutes: number
}

export interface AuthFailureDetail {
  mensaje: string
  bloqueado: boolean
  intentos_fallidos: number
  intentos_restantes: number
  minutos_restantes_bloqueo: number
  bloqueado_hasta?: string | null
}

export type CrawlerStatus = 'idle' | 'running' | 'error'

export interface PortalStatus {
  key: string
  name: string
  url: string
  records: number
  lastRun: string
  status: CrawlerStatus
}

export interface DailyScrapeItem {
  day: string
  count: number
}

export interface AuditLogItem {
  id: number
  time: string
  event: string
  result: 'OK' | 'WARN' | 'ERROR'
  records?: number | null
  usuario: string
}

export interface ModelStatus {
  version: string
  fecha_entrenamiento: string
  mape_poblado_pct: number
  mape_otras_comunas_pct: number
  mape_global_pct: number
  umbral_rn01_pct: number
  en_produccion: boolean
  total_registros_entrenamiento: number
  historial_mape: number[]
}

export interface AdminDashboardResponse {
  total_inmuebles: number
  portales_activos: number
  ultima_extraccion_texto: string
  ultimos_registros_procesados: number
  portales: PortalStatus[]
  scrape_data: DailyScrapeItem[]
  modelo: ModelStatus
  audit_logs: AuditLogItem[]
}

export interface CrawlerRunResponse {
  exito: boolean
  portales_ejecutados: string[]
  registros_extraidos_brutos: number
  registros_validos_rn06: number
  nuevos_insertados: number
  actualizados: number
  duracion_segundos: number
  mensaje: string
}

export interface ModelRetrainResponse {
  exito: boolean
  promovido_a_produccion: boolean
  version_modelo: string
  mape_poblado_pct: number
  mape_otras_comunas_pct: number
  mape_global_pct: number
  umbral_rn01_pct: number
  total_registros_entrenamiento: number
  mensaje: string
}
