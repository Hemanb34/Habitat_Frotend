import { useState } from 'react'
import { calculateMarginByStrategy, estimatePropertyPrice } from '../api/client'
import {
  NavigateFn,
  PricingRecommendation,
  PricingStrategyKey,
  PropertyEstimateResponse,
} from '../types'

// Las 16 comunas urbanas oficiales de Medellín (unificando Laureles - Estadio)
const COMUNAS_MEDELLIN = [
  'Aranjuez',
  'Belén',
  'Buenos Aires',
  'Castilla',
  'Doce de Octubre',
  'El Poblado',
  'Guayabal',
  'La América',
  'La Candelaria',
  'Laureles - Estadio',
  'Manrique',
  'Popular',
  'Robledo',
  'San Javier',
  'Santa Cruz',
  'Villa Hermosa',
]

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)

interface PropietarioProps {
  navigate: NavigateFn
}

export default function Propietario({ navigate }: PropietarioProps) {
  const [step, setStep] = useState<'form' | 'loading' | 'results'>('form')
  const [form, setForm] = useState({
    tipo: 'Apartamento',
    neighborhood: 'Laureles - Estadio',
    barrio: '',
    area: '80',
    estrato: '4',
    rooms: '3',
    baths: '2',
    parking: true,
    amoblado: false,
    incluyeAdmin: true,
  })
  const [result, setResult] = useState<PropertyEstimateResponse | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState<PricingStrategyKey>('balanceada')
  const [activeStrategyData, setActiveStrategyData] =
    useState<PricingRecommendation | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const set = (k: string, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleSelectStrategy = async (strategyKey: PricingStrategyKey) => {
    setSelectedStrategy(strategyKey)
    if (!result) return

    // Si ya viene precalculada en el diccionario, la aplicamos de inmediato y validamos con /margin
    if (result.estrategias_comerciales?.[strategyKey]) {
      setActiveStrategyData(result.estrategias_comerciales[strategyKey])
    }

    try {
      const updated = await calculateMarginByStrategy({
        estrategia: strategyKey,
        precio_base_estimado: result.precio_estimado,
        metricas_mercado: result.metricas_mercado,
      })
      setActiveStrategyData(updated)
    } catch {
      // Mantiene el cálculo local del diccionario si hay latencia de red
    }
  }

  const handleSubmit = async () => {
    const areaNum = parseFloat(form.area)
    if (Number.isNaN(areaNum) || areaNum < 15 || areaNum > 500) {
      setErrorMsg(
        'El área construida debe estar entre 15 m² y 500 m² para realizar una estimación válida (Flujo de Excepción E1).'
      )
      return
    }
    const estratoNum = parseInt(form.estrato, 10) || 4
    const roomsNum = parseInt(form.rooms, 10) || 3
    const bathsNum = parseInt(form.baths, 10) || 2

    setErrorMsg(null)
    setStep('loading')

    try {
      const response = await estimatePropertyPrice({
        comuna: form.neighborhood,
        barrio: form.barrio.trim() || null,
        tipo_inmueble: form.tipo,
        area: areaNum,
        estrato: estratoNum,
        habitaciones: roomsNum,
        banos: bathsNum,
        parqueaderos: form.parking ? 1 : 0,
        amoblado: form.amoblado,
        incluye_administracion: form.incluyeAdmin,
      })
      setResult(response)
      setSelectedStrategy('balanceada')
      setActiveStrategyData(
        response.estrategias_comerciales?.balanceada || null
      )
      setStep('results')
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error al consultar la fachada de valoración en el Backend.'
      )
      setStep('form')
    }
  }

  const marketMin = result ? result.metricas_mercado.precio_minimo : 0
  const marketMax = result ? result.metricas_mercado.precio_maximo : 0
  const marketAvg = result ? result.metricas_mercado.precio_promedio : 0
  const suggestedLow = result ? result.rango_sugerido_inferior : 0
  const suggestedHigh = result ? result.rango_sugerido_superior : 0

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
          Análisis de inmueble — Propietario
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 md:px-16 py-10">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8">
          {['Datos del inmueble', 'Resultados del análisis'].map((label, i) => {
            const active = step === 'form' || step === 'loading' ? i === 0 : i === 1
            const done = step === 'results' && i === 0
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done
                      ? 'bg-[#06C167] text-white'
                      : active
                      ? 'bg-black text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`text-sm font-medium ${active ? 'text-black' : 'text-gray-400'}`}>
                  {label}
                </span>
                {i === 0 && <div className="w-12 h-px bg-gray-200 ml-1" />}
              </div>
            )
          })}
        </div>

        {/* STEP 1 — Form */}
        {step === 'form' && (
          <div className="grid md:grid-cols-5 gap-10">
            <div className="md:col-span-3">
              <h1 className="text-3xl font-bold mb-2">Analiza tu inmueble</h1>
              <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                Ingresa las características de tu propiedad y obtendrás una estimación de precio en tiempo real basada en el modelo de IA y los competidores comparables en PostgreSQL (RN-03).
              </p>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Tipo de inmueble</label>
                    <select
                      value={form.tipo}
                      onChange={e => set('tipo', e.target.value)}
                      className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none"
                    >
                      <option>Apartamento</option>
                      <option>Casa</option>
                      <option>Apartaestudio</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Comuna (Medellín)</label>
                    <select
                      value={form.neighborhood}
                      onChange={e => set('neighborhood', e.target.value)}
                      className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none"
                    >
                      {COMUNAS_MEDELLIN.map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Barrio específico <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.barrio}
                    onChange={e => set('barrio', e.target.value)}
                    placeholder="Ej. Provenza, Conquistadores, Los Colores..."
                    className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Área construida (m²)</label>
                    <input
                      type="number"
                      min={15}
                      max={1000}
                      value={form.area}
                      onChange={e => set('area', e.target.value)}
                      placeholder="80"
                      className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Estrato</label>
                    <select
                      value={form.estrato}
                      onChange={e => set('estrato', e.target.value)}
                      className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>
                          Estrato {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Habitaciones</label>
                    <select
                      value={form.rooms}
                      onChange={e => set('rooms', e.target.value)}
                      className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none"
                    >
                      {[1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Baños</label>
                    <select
                      value={form.baths}
                      onChange={e => set('baths', e.target.value)}
                      className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none"
                    >
                      {[1, 2, 3, 4].map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Parqueadero</label>
                    <button
                      type="button"
                      onClick={() => set('parking', !form.parking)}
                      className={`w-full rounded-xl px-4 py-3 text-sm font-semibold border-2 transition-colors ${
                        form.parking
                          ? 'bg-black text-white border-black'
                          : 'bg-gray-100 text-gray-500 border-transparent'
                      }`}
                    >
                      {form.parking ? 'Sí incluye' : 'No incluye'}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                className="mt-8 w-full bg-black text-white font-semibold py-4 rounded-xl hover:bg-gray-900 transition-colors"
              >
                Estimar precio del inmueble
              </button>
            </div>

            {/* Right side info */}
            <div className="md:col-span-2 space-y-4 pt-14">
              <div className="bg-gray-50 rounded-2xl p-5">
                <div className="text-xs font-semibold text-[#06C167] uppercase tracking-wider mb-2">
                  Modelo predictivo (RN-01)
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Nuestro modelo segmentado (El Poblado y Otras Comunas) mantiene un error porcentual absoluto medio (MAPE) inferior al 16%.
                </p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-5">
                <div className="text-xs font-semibold text-[#06C167] uppercase tracking-wider mb-2">
                  Competidores similares (RN-03)
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Recibirás propiedades activas de PostgreSQL con la misma comuna, mismo estrato, mismo tipo y área dentro del rango ±15%.
                </p>
              </div>
              <div className="bg-black rounded-2xl p-5">
                <div className="text-xs font-semibold text-[#06C167] uppercase tracking-wider mb-2">
                  Rango sugerido (RN-04)
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Te entregaremos un rango -5% / +5% sobre la estimación base para que fijes un precio competitivo sin especular.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin mb-6" />
            <p className="font-semibold text-lg mb-1">Calculando estimación de precio...</p>
            <p className="text-gray-500 text-sm">
              Ejecutando en paralelo (Fork/Join) el modelo predictivo y la búsqueda SQL RN-03
            </p>
          </div>
        )}

        {/* RESULTS */}
        {step === 'results' && result && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold">Resultados del análisis</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {form.tipo} en {form.neighborhood}
                  {form.barrio.trim() ? ` (${form.barrio.trim()})` : ''} · {form.area} m² · Estrato{' '}
                  {form.estrato}
                </p>
              </div>
              <button
                onClick={() => {
                  setStep('form')
                  setResult(null)
                }}
                className="text-sm font-medium text-gray-500 hover:text-black border border-gray-200 px-4 py-2 rounded-full transition-colors"
              >
                Nueva consulta
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-5 mb-7">
              {/* Estimated price */}
              <div className="md:col-span-2 bg-black text-white rounded-2xl p-7">
                <div className="text-xs font-semibold text-[#06C167] uppercase tracking-wider mb-3">
                  Precio estimado por IA ({result.modelo_utilizado})
                </div>
                <div className="text-5xl font-bold mb-2">{formatCOP(result.precio_estimado)}</div>
                <div className="text-gray-400 text-sm">
                  por mes ({formatCOP(result.precio_m2_estimado)}/m²) · comparado con{' '}
                  {result.competidores.length} propiedades bajo RN-03
                </div>
                <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06C167" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-sm text-gray-400">
                    Umbral de calidad RN-01: &le;{result.umbral_rn01_pct}% (MAPE actual:{' '}
                    {result.mape_modelo_pct}%)
                  </span>
                </div>
              </div>

              {/* Quick stats */}
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Competidores RN-03 encontrados</div>
                  <div className="text-2xl font-bold">{result.competidores.length}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Área entre {result.metricas_mercado.rango_area_min_rn03} y{' '}
                    {result.metricas_mercado.rango_area_max_rn03} m²
                  </div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Promedio del mercado (RF-05)</div>
                  <div className="text-2xl font-bold">{formatCOP(marketAvg)}</div>
                </div>
              </div>
            </div>

            {/* Market context */}
            <div className="bg-gray-50 rounded-2xl p-6 mb-5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Contexto de mercado — Propiedades comparables en {form.neighborhood}
              </div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: 'Mínimo', value: formatCOP(marketMin), color: 'text-blue-600' },
                  { label: 'Promedio', value: formatCOP(marketAvg), color: 'text-black' },
                  { label: 'Máximo', value: formatCOP(marketMax), color: 'text-orange-600' },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
              {/* Range bar */}
              <div className="relative">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 via-gray-400 to-orange-400 rounded-full" />
                </div>
                {/* Estimated marker */}
                {marketMax > marketMin && (
                  <div
                    className="absolute top-0 -translate-x-1/2"
                    style={{
                      left: `${Math.min(
                        95,
                        Math.max(
                          5,
                          ((result.precio_estimado - marketMin) / (marketMax - marketMin)) * 100
                        )
                      )}%`,
                    }}
                  >
                    <div className="w-4 h-4 bg-black border-2 border-white rounded-full shadow -mt-0.5" />
                    <div className="text-xs font-bold text-center mt-1 whitespace-nowrap -translate-x-1/4">
                      Tu est.
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-4">
                <span>{formatCOP(marketMin)}</span>
                <span>{formatCOP(marketMax)}</span>
              </div>
            </div>

            {/* Competitors table */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-5">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold">Propiedades competidoras activas (RN-03)</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Misma comuna ({form.neighborhood}), Estrato {form.estrato}, {form.tipo} y área ±15% (
                  {result.metricas_mercado.rango_area_min_rn03} –{' '}
                  {result.metricas_mercado.rango_area_max_rn03} m²)
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {result.competidores.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-gray-400">
                    No se encontraron competidores con exactamente la misma combinación en la muestra actual; las métricas reflejan la referencia del sector.
                  </div>
                ) : (
                  result.competidores.map((c, i) => (
                    <div
                      key={c.id}
                      onClick={() => window.open(c.url_origen, '_blank', 'noopener,noreferrer')}
                      className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">
                          {i + 1}
                        </div>
                        <div>
                          <span className="text-sm font-medium hover:underline">{c.title}</span>
                          <div className="text-xs text-gray-400">
                            {c.area} m² · {c.habitaciones} hab. · {c.banos} baños · {c.portal}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{formatCOP(c.precio_publicado)}</div>
                        <div
                          className={`text-xs ${
                            c.diferencia_vs_estimado_pct > 0 ? 'text-orange-500' : 'text-green-600'
                          }`}
                        >
                          {c.diferencia_vs_estimado_pct > 0
                            ? `+${c.diferencia_vs_estimado_pct.toFixed(1)}% vs estimado`
                            : `${c.diferencia_vs_estimado_pct.toFixed(1)}% vs estimado`}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Suggested range with GoF Strategy Selector (F4 - RN-04) */}
            <div className="border-2 border-black rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#06C167] rounded-full flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider">
                    Recomendación de IA — Estrategias de Publicación (Patrón Strategy · RN-04)
                  </div>
                </div>

                {/* Selector interactivo de las 3 estrategias GoF Strategy */}
                <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-full">
                  {(
                    [
                      { key: 'liquidez', label: 'Liquidez Rápida (-5%)' },
                      { key: 'balanceada', label: 'Balanceada' },
                      { key: 'rentabilidad', label: 'Máx. Rentabilidad (+5%)' },
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleSelectStrategy(tab.key)}
                      className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all ${
                        selectedStrategy === tab.key
                          ? 'bg-black text-white shadow-sm'
                          : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeStrategyData && (
                <div className="bg-black text-white rounded-xl p-5 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-[#06C167] uppercase tracking-wider mb-1">
                      {activeStrategyData.nombre_estrategia}
                    </div>
                    <div className="text-3xl font-bold">
                      {formatCOP(activeStrategyData.precio_sugerido)}
                      <span className="text-sm font-normal text-gray-400"> / mes sugerido</span>
                    </div>
                    <div className="text-xs text-gray-300 mt-1">
                      {activeStrategyData.objetivo_comercial}
                    </div>
                  </div>
                  <div className="md:text-right">
                    <span
                      className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                        activeStrategyData.ajuste_aplicado_pct < 0
                          ? 'bg-emerald-500/20 text-[#06C167]'
                          : activeStrategyData.ajuste_aplicado_pct > 0
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      {activeStrategyData.ajuste_aplicado_pct > 0
                        ? `+${activeStrategyData.ajuste_aplicado_pct}% vs IA`
                        : `${activeStrategyData.ajuste_aplicado_pct}% vs IA`}
                    </span>
                    <div className="text-xs text-gray-400 mt-2 max-w-xs">
                      {activeStrategyData.explicacion}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Límite inferior comercial (-5%)</div>
                  <div className="text-2xl font-bold">{formatCOP(suggestedLow)}</div>
                  <div className="text-xs text-[#06C167] mt-1 font-medium">
                    Para arrendar más rápido (Liquidez)
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Límite superior comercial (+5%)</div>
                  <div className="text-2xl font-bold">{formatCOP(suggestedHigh)}</div>
                  <div className="text-xs text-orange-500 mt-1 font-medium">
                    Para máxima rentabilidad (Techo competitivo)
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                Rango calculado aplicando ±5% (RN-04) sobre la estimación base del modelo ({formatCOP(result.precio_estimado)}), modulado contra los competidores reales de {form.neighborhood}.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
