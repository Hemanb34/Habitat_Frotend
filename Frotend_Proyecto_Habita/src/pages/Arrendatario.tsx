import { useEffect, useState } from 'react'
import { fetchCatalogProperties } from '../api/client'
import { CatalogInitialFilters, CatalogSortOrder, NavigateFn, Property } from '../types'

const FALLBACK_IMAGE_URL =
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=480&fit=crop&auto=format'

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)

function getDealBadgeStyle(etiqueta: string, diffPct: number) {
  if (etiqueta === 'Excelente precio' || diffPct > 10) {
    return {
      label: etiqueta || 'Excelente precio',
      cls: 'bg-green-100 text-green-700 border-green-200',
    }
  }
  if (etiqueta === 'Buen precio' || diffPct > 4) {
    return {
      label: etiqueta || 'Buen precio',
      cls: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    }
  }
  if (etiqueta === 'Precio justo' || diffPct > -5) {
    return {
      label: etiqueta || 'Precio justo',
      cls: 'bg-gray-100 text-gray-500 border-gray-200',
    }
  }
  return {
    label: etiqueta || 'Precio elevado',
    cls: 'bg-orange-100 text-orange-700 border-orange-200',
  }
}

interface ArrendatarioProps {
  navigate: NavigateFn
  initialFilters?: CatalogInitialFilters
}

export default function Arrendatario({ navigate, initialFilters }: ArrendatarioProps) {
  const [neighborhood, setNeighborhood] = useState(initialFilters?.comuna || 'Todos')
  const [type, setType] = useState(initialFilters?.type || 'Todos')
  const [sort, setSort] = useState<CatalogSortOrder>('mejor-oferta')
  const [selected, setSelected] = useState<Property | null>(null)

  // Estados conectados al Backend (GET /api/v1/properties)
  const [properties, setProperties] = useState<Property[]>([])
  const [totalAvailable, setTotalAvailable] = useState<number>(0)
  const [comunasDisponibles, setComunasDisponibles] = useState<string[]>([])
  const [tiposDisponibles, setTiposDisponibles] = useState<string[]>([
    'Apartamento',
    'Casa',
    'Apartaestudio',
  ])
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState<number>(0)

  const handleResetFilters = () => {
    setNeighborhood('Todos')
    setType('Todos')
    setSort('mejor-oferta')
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setErrorMsg(null)

    fetchCatalogProperties({
      comuna: neighborhood,
      tipo_inmueble: type,
      ordenar_por: sort,
      limit: 60,
    })
      .then(data => {
        if (!active) return
        setProperties(data.items)
        setTotalAvailable(data.total)
        if (data.comunas_disponibles.length > 0) {
          setComunasDisponibles(data.comunas_disponibles)
        }
        if (data.tipos_disponibles.length > 0) {
          setTiposDisponibles(data.tipos_disponibles)
        }
      })
      .catch(err => {
        if (!active) return
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'No fue posible conectar con el servidor Backend (puerto 8000).'
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [neighborhood, type, sort, reloadTick])

  const neighborhoods = ['Todos', ...comunasDisponibles]
  const propertyTypes = ['Todos', ...tiposDisponibles]

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="bg-black px-6 md:px-16 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('landing')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Inicio</span>
          </button>
          <button onClick={() => navigate('landing')} className="flex items-center gap-2 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06C167" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="text-lg font-bold">habitá</span>
          </button>
        </div>
        <div className="text-white/60 text-sm font-medium hidden md:block">
          Panel de búsqueda — Arrendatario
        </div>
      </nav>

      {/* Page header */}
      <div className="max-w-7xl mx-auto px-6 md:px-16 pt-10 pb-6">
        <h1 className="text-3xl font-bold mb-1">Buscar inmuebles</h1>
        <p className="text-gray-500 text-sm">
          {loading ? 'Consultando catálogo en PostgreSQL...' : `${totalAvailable} inmuebles disponibles`}{' '}
          · Mostrando {properties.length} · Ordenados por{' '}
          <span className="text-black font-medium">
            {sort === 'mejor-oferta'
              ? 'Mejor oferta'
              : sort === 'menor-precio'
              ? 'Menor precio'
              : 'Mayor área'}
          </span>
        </p>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-100 sticky top-[60px] bg-white z-40">
        <div className="max-w-7xl mx-auto px-6 md:px-16 py-3 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span className="text-sm text-gray-500 font-medium">Filtros:</span>
          </div>

          <select
            value={neighborhood}
            onChange={e => setNeighborhood(e.target.value)}
            className="text-sm bg-gray-100 rounded-full px-4 py-2 outline-none font-medium cursor-pointer hover:bg-gray-200 transition-colors"
          >
            {neighborhoods.map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="text-sm bg-gray-100 rounded-full px-4 py-2 outline-none font-medium cursor-pointer hover:bg-gray-200 transition-colors"
          >
            {propertyTypes.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-500">Ordenar:</span>
            {(['mejor-oferta', 'menor-precio', 'mayor-area'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
                  sort === s ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'mejor-oferta'
                  ? 'Mejor oferta'
                  : s === 'menor-precio'
                  ? 'Menor precio'
                  : 'Mayor área'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Source portals badge */}
      <div className="max-w-7xl mx-auto px-6 md:px-16 py-3 flex items-center gap-2 text-xs text-gray-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Datos extraídos de Finca Raíz, Metrocuadrado y CienCuadras · Catálogo consolidado con trazabilidad RN-06
      </div>

      {/* Property grid */}
      <div className="max-w-7xl mx-auto px-6 md:px-16 pb-16">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6 text-sm flex items-center justify-between gap-4">
            <span>{errorMsg}</span>
            <button
              onClick={() => setReloadTick(t => t + 1)}
              className="bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-red-700 transition-colors flex-shrink-0"
            >
              Reintentar conexión
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="border border-gray-100 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-10 bg-gray-100 rounded mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map(prop => {
              const deal = getDealBadgeStyle(prop.etiqueta_oferta, prop.diferencia_pct)
              const diffPct = prop.diferencia_pct
              return (
                <div
                  key={prop.id}
                  className="border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => setSelected(prop)}
                >
                  <div className="relative h-48 bg-gray-100 overflow-hidden">
                    <img
                      src={prop.imagen_url || FALLBACK_IMAGE_URL}
                      onError={e => {
                        e.currentTarget.src = FALLBACK_IMAGE_URL
                      }}
                      alt={prop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${deal.cls}`}>
                        {deal.label}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
                      {prop.portal}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-bold text-base leading-tight line-clamp-1">{prop.title}</p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {prop.comuna} · {prop.tipo_inmueble} · Estrato {prop.estrato}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 my-3">
                      <span className="flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="7" width="20" height="14" rx="2" />
                          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                        </svg>
                        {prop.habitaciones} hab.
                      </span>
                      <span className="flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 6H20M9 12H20M9 18H20M5 6h.01M5 12h.01M5 18h.01" />
                        </svg>
                        {prop.banos} baños
                      </span>
                      <span>{prop.area} m²</span>
                      {prop.parqueaderos > 0 && <span>P×{prop.parqueaderos}</span>}
                    </div>

                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="text-lg font-bold">{formatCOP(prop.precio_publicado)}</div>
                          <div className="text-xs text-gray-400">Precio publicado / mes</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-600">
                            {formatCOP(prop.precio_estimado)}
                          </div>
                          <div
                            className={`text-xs font-semibold ${
                              diffPct > 0 ? 'text-green-600' : 'text-orange-600'
                            }`}
                          >
                            {diffPct > 0
                              ? `${diffPct.toFixed(1)}% por debajo`
                              : `${Math.abs(diffPct).toFixed(1)}% por encima`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && properties.length === 0 && !errorMsg && (
          <div className="text-center py-20 text-gray-400">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="font-medium text-gray-600">No se encontraron inmuebles con estos filtros</p>
            <p className="text-sm mt-1 mb-5">Intenta cambiar la comuna o el tipo de inmueble</p>
            <button
              onClick={handleResetFilters}
              className="bg-black text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-gray-900 transition-colors"
            >
              Restablecer filtros
            </button>
          </div>
        )}
      </div>

      {/* Property detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative h-64 bg-gray-100 overflow-hidden rounded-t-2xl">
              <img
                src={selected.imagen_url || FALLBACK_IMAGE_URL}
                onError={e => {
                  e.currentTarget.src = FALLBACK_IMAGE_URL
                }}
                alt={selected.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="absolute top-4 left-4">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                    getDealBadgeStyle(selected.etiqueta_oferta, selected.diferencia_pct).cls
                  }`}
                >
                  {getDealBadgeStyle(selected.etiqueta_oferta, selected.diferencia_pct).label}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between mb-4 gap-3">
                <div>
                  <h2 className="text-xl font-bold">{selected.title}</h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {selected.comuna} · {selected.tipo_inmueble} · Estrato {selected.estrato}
                  </p>
                </div>
                <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium flex-shrink-0">
                  {selected.portal}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Área', value: `${selected.area} m²` },
                  { label: 'Habitaciones', value: selected.habitaciones },
                  { label: 'Baños', value: selected.banos },
                  { label: 'Parqueo', value: selected.parqueaderos > 0 ? `×${selected.parqueaderos}` : '—' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="font-bold text-base">{item.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-0.5">Precio publicado</div>
                    <div className="text-2xl font-bold">
                      {formatCOP(selected.precio_publicado)}
                      <span className="text-sm font-normal text-gray-400">/mes</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-0.5">Estimado por IA</div>
                    <div className="text-lg font-semibold text-gray-700">
                      {formatCOP(selected.precio_estimado)}
                    </div>
                  </div>
                </div>
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full rounded-full ${
                      selected.diferencia_pct > 0 ? 'bg-green-500' : 'bg-orange-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(5, 50 + selected.diferencia_pct * 2)
                      )}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {selected.diferencia_pct > 0
                    ? `Este inmueble está ${selected.diferencia_pct.toFixed(
                        1
                      )}% por debajo del precio estimado — una buena oferta.`
                    : `Este inmueble está ${Math.abs(selected.diferencia_pct).toFixed(
                        1
                      )}% por encima del precio estimado.`}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 bg-black text-white font-semibold py-3 rounded-xl text-sm hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                  onClick={() =>
                    window.open(selected.url_origen, '_blank', 'noopener,noreferrer')
                  }
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Ir a la oferta original
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="px-5 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
