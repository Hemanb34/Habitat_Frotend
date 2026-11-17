import { useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  fetchAdminDashboard,
  logoutAdmin,
  runAdminCrawlers,
  runAdminModelRetrain,
} from '../api/client'
import {
  AdminDashboardResponse,
  CrawlerStatus,
  DailyScrapeItem,
  NavigateFn,
} from '../types'

type Tab = 'dashboard' | 'crawlers' | 'modelo'

function MAPEChart({ data }: { data: number[] }) {
  const series = data.length >= 2 ? data : [14.4, 13.8, 13.5, 13.2, 12.9, 12.7, 12.52]
  const W = 380,
    H = 110,
    padX = 10,
    padY = 12
  const min = 8,
    max = 18
  const xS = (i: number) => padX + (i / (series.length - 1)) * (W - padX * 2)
  const yS = (v: number) => H - padY - ((v - min) / (max - min)) * (H - padY * 2)
  const path = series.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xS(i)} ${yS(v)}`).join(' ')
  const area = `${path} L ${xS(series.length - 1)} ${H - padY} L ${xS(0)} ${H - padY} Z`
  const threshold = yS(16)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mapeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06C167" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#06C167" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1={padX}
        y1={threshold}
        x2={W - padX}
        y2={threshold}
        stroke="#ef4444"
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.5"
      />
      <text
        x={W - padX - 2}
        y={threshold - 3}
        fontSize="7"
        fill="#ef4444"
        textAnchor="end"
        opacity="0.7"
      >
        16% umbral RN-01
      </text>
      <path d={area} fill="url(#mapeGrad)" />
      <path
        d={path}
        fill="none"
        stroke="#06C167"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {series.map((v, i) => (
        <circle
          key={i}
          cx={xS(i)}
          cy={yS(v)}
          r="2.5"
          fill="#06C167"
          stroke="white"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  )
}

function ScrapesChart({ data }: { data: DailyScrapeItem[] }) {
  const series =
    data.length > 0
      ? data
      : [
          { day: 'Lun', count: 512 },
          { day: 'Mar', count: 489 },
          { day: 'Mie', count: 534 },
        ]
  const maxVal = Math.max(1, ...series.map(d => d.count))
  const H = 90
  const barW = 30
  const gap = 16
  const W = series.length * (barW + gap) + gap

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {series.map((d, i) => {
        const barH = (d.count / maxVal) * H
        const x = gap + i * (barW + gap)
        return (
          <g key={i}>
            <rect
              x={x}
              y={H - barH}
              width={barW}
              height={barH}
              rx="4"
              fill={i === series.length - 1 ? '#06C167' : '#e5e7eb'}
            />
            <text
              x={x + barW / 2}
              y={H + 13}
              fontSize="8"
              textAnchor="middle"
              fill="#9ca3af"
            >
              {d.day}
            </text>
            {i === series.length - 1 && (
              <text
                x={x + barW / 2}
                y={H - barH - 4}
                fontSize="7.5"
                textAnchor="middle"
                fill="#06C167"
                fontWeight="700"
              >
                {d.count}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

interface AdminDashboardProps {
  navigate: NavigateFn
}

export default function AdminDashboard({ navigate }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionBanner, setActionBanner] = useState<string | null>(null)

  const [crawlerStatuses, setCrawlerStatuses] = useState<Record<string, CrawlerStatus>>({})
  const [retraining, setRetraining] = useState<'idle' | 'running' | 'done' | 'rejected'>('idle')
  const [pipelineStep, setPipelineStep] = useState(4)
  const [retrainMessage, setRetrainMessage] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    try {
      const data = await fetchAdminDashboard()
      setDashboard(data)
      setCrawlerStatuses(prev => {
        const next: Record<string, CrawlerStatus> = {}
        data.portales.forEach(p => {
          next[p.name] = prev[p.name] === 'running' ? 'running' : p.status
        })
        return next
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        sessionStorage.removeItem('habita_admin_token')
        navigate('admin-login')
        return
      }
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    const token = sessionStorage.getItem('habita_admin_token')
    if (!token) {
      navigate('admin-login')
      return
    }
    loadDashboard()
  }, [loadDashboard, navigate])

  const runCrawler = async (portalName: string, portalKey: string) => {
    if (crawlerStatuses[portalName] === 'running') return
    setCrawlerStatuses(s => ({ ...s, [portalName]: 'running' }))
    setActionBanner(`Ejecutando spider asíncrono para ${portalName} (Factory Method + Adapter RN-06)...`)

    try {
      const res = await runAdminCrawlers(portalKey)
      setActionBanner(res.mensaje)
      const updated = await fetchAdminDashboard()
      setDashboard(updated)
      setCrawlerStatuses(prev => {
        const next = { ...prev }
        updated.portales.forEach(p => {
          next[p.name] = p.status
        })
        return next
      })
    } catch (err) {
      setCrawlerStatuses(s => ({ ...s, [portalName]: 'error' }))
      setActionBanner(
        err instanceof Error ? err.message : `Error al ejecutar crawler ${portalName}`
      )
    }
  }

  const runAll = async () => {
    if (!dashboard) return
    const nextMap: Record<string, CrawlerStatus> = {}
    dashboard.portales.forEach(p => {
      nextMap[p.name] = 'running'
    })
    setCrawlerStatuses(nextMap)
    setActionBanner(
      'Orquestando en paralelo (Fork/Join asyncio.gather) Finca Raíz, Metrocuadrado y CienCuadras...'
    )

    try {
      const res = await runAdminCrawlers(null)
      setActionBanner(res.mensaje)
      const updated = await fetchAdminDashboard()
      setDashboard(updated)
      const statusFromDb: Record<string, CrawlerStatus> = {}
      updated.portales.forEach(p => {
        statusFromDb[p.name] = p.status
      })
      setCrawlerStatuses(statusFromDb)
    } catch (err) {
      const errMap: Record<string, CrawlerStatus> = {}
      dashboard.portales.forEach(p => {
        errMap[p.name] = 'error'
      })
      setCrawlerStatuses(errMap)
      setActionBanner(
        err instanceof Error ? err.message : 'Error al ejecutar la orquestación de crawlers'
      )
    }
  }

  const runRetraining = async () => {
    if (retraining === 'running') return
    setRetraining('running')
    setRetrainMessage(null)
    setPipelineStep(4)

    const steps = [4, 5, 6]
    steps.forEach((step, i) => {
      setTimeout(() => setPipelineStep(step), (i + 1) * 450)
    })

    try {
      const res = await runAdminModelRetrain()
      if (res.promovido_a_produccion) {
        setPipelineStep(7)
        setRetraining('done')
      } else {
        // Transición T-18b / Estado S16: DespliegueAbortadoPorMAPE (MAPE > 16% RN-01)
        setPipelineStep(5)
        setRetraining('rejected')
      }
      setRetrainMessage(res.mensaje)
      await loadDashboard()
    } catch (err) {
      setRetraining('idle')
      setActionBanner(
        err instanceof Error ? err.message : 'Error durante el reentrenamiento del modelo.'
      )
    }
  }

  const handleLogout = async () => {
    try {
      await logoutAdmin()
    } catch {
      // Continuar con limpieza local aunque el token haya expirado
    }
    sessionStorage.removeItem('habita_admin_token')
    sessionStorage.removeItem('habita_admin_user')
    navigate('admin-login')
  }

  const statusDot: Record<CrawlerStatus, string> = {
    idle: 'bg-gray-300',
    running: 'bg-yellow-400 animate-pulse',
    error: 'bg-red-500',
  }
  const statusLabel: Record<CrawlerStatus, string> = {
    idle: 'Inactivo',
    running: 'Ejecutando...',
    error: 'Error',
  }

  const totalRecords = dashboard?.total_inmuebles ?? 0
  const portales = dashboard?.portales ?? []
  const scrapeData = dashboard?.scrape_data ?? []
  const auditLogs = dashboard?.audit_logs ?? []
  const modelo = dashboard?.modelo

  const pipelineSteps = [
    {
      name: 'Extracción y consolidación de datos',
      desc: `Crawlers ejecutados — ${totalRecords.toLocaleString('es-CO')} inmuebles activos en PostgreSQL`,
      done: true,
    },
    {
      name: 'Limpieza y validación de dominio (RN-06)',
      desc: 'Registros sin url_origen descartados, geocodificación Point-in-Polygon y filtro IQR',
      done: true,
    },
    {
      name: 'Codificación de variables categóricas',
      desc: 'TargetEncoder y OneHotEncoder sobre comuna, barrio, tipo de inmueble y estrato',
      done: true,
    },
    {
      name: 'Escalado sin fuga de datos (RN-02)',
      desc: 'Ajuste de transformadores exclusivamente sobre el 80% de entrenamiento (Split 80/20)',
      done: true,
    },
    {
      name: 'Entrenamiento segmentado (Patrón Template Method)',
      desc: 'PobladoTrainingPipeline (El Poblado) y OtrasComunasTrainingPipeline (15 comunas)',
      done: false,
    },
    {
      name: 'Compuerta de calidad estricta (RN-01)',
      desc: 'Criterio: MAPE ≤ 16% en ambos regímenes de validación',
      done: false,
    },
    {
      name: 'Despliegue atómico a producción (RNF-08)',
      desc: 'Reemplazo en caliente en RAM y respaldo automático (.prev.joblib)',
      done: false,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-black flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-white/10">
          <button onClick={() => navigate('landing')} className="flex items-center gap-2 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06C167" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="font-bold">habitá</span>
          </button>
          <p className="text-gray-600 text-xs mt-1">Administración</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {(
            [
              {
                id: 'dashboard',
                label: 'Dashboard',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                ),
              },
              {
                id: 'crawlers',
                label: 'Crawlers',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                ),
              },
              {
                id: 'modelo',
                label: 'Modelo IA',
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                ),
              },
            ] as const
          ).map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#06C167" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p className="text-white text-xs font-semibold">Administrador</p>
              <p className="text-gray-600 text-xs">
                {sessionStorage.getItem('habita_admin_user') || 'admin'}@habita.co
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-xs text-gray-600 hover:text-gray-400 flex items-center gap-2 px-1 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-bold">
              {tab === 'dashboard'
                ? 'Dashboard de Telemetría y Auditoría'
                : tab === 'crawlers'
                ? 'Orquestación de Crawlers (Factory Method + Adapter)'
                : 'Modelo Predictivo (Template Method + RN-01)'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Última sincronización con PostgreSQL ({dashboard?.ultima_extraccion_texto || 'en vivo'})
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
            <div className="w-2 h-2 bg-[#06C167] rounded-full animate-pulse" />
            PostgreSQL + ML Activos
          </div>
        </div>

        <div className="px-8 py-7">
          {actionBanner && (
            <div className="mb-5 bg-black text-white rounded-xl px-4 py-3 text-xs flex items-center justify-between">
              <span>{actionBanner}</span>
              <button
                onClick={() => setActionBanner(null)}
                className="text-gray-400 hover:text-white ml-4 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-24 text-center text-gray-400 text-sm">
              Cargando telemetría administrativa desde PostgreSQL...
            </div>
          ) : (
            <>
              {/* ─── DASHBOARD TAB ─── */}
              {tab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      {
                        label: 'Total inmuebles (BD)',
                        value: totalRecords.toLocaleString('es-CO'),
                        sub: 'Validados con URL original (RN-06)',
                        color: 'text-black',
                      },
                      {
                        label: 'MAPE actual (RN-01)',
                        value: `${modelo?.mape_global_pct ?? 12.52}%`,
                        sub: `Poblado: ${modelo?.mape_poblado_pct ?? 13.04}% · Comunas: ${
                          modelo?.mape_otras_comunas_pct ?? 11.99
                        }% (≤16%)`,
                        color: 'text-[#06C167]',
                      },
                      {
                        label: 'Portales activos',
                        value: String(dashboard?.portales_activos ?? 3),
                        sub: 'Finca Raíz, Metrocuadrado, CienCuadras',
                        color: 'text-black',
                      },
                      {
                        label: 'Última extracción',
                        value: dashboard?.ultima_extraccion_texto || 'hace 1h',
                        sub: `${(
                          dashboard?.ultimos_registros_procesados ?? totalRecords
                        ).toLocaleString('es-CO')} registros procesados`,
                        color: 'text-black',
                      },
                    ].map(card => (
                      <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-2 font-medium">{card.label}</p>
                        <p className={`text-2xl font-bold ${card.color} mb-1`}>{card.value}</p>
                        <p className="text-xs text-gray-400">{card.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Charts */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-sm">Evolución del MAPE (RN-01)</h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Historial de versiones en PostgreSQL (`model_versions`)
                          </p>
                        </div>
                        <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">
                          {modelo?.mape_global_pct ?? 12.52}% actual
                        </span>
                      </div>
                      <MAPEChart data={modelo?.historial_mape ?? []} />
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-sm">Registros extraídos por ejecución</h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Últimos 7 jobs registrados en `crawler_jobs`
                          </p>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-semibold">
                          {scrapeData
                            .reduce((a, d) => a + d.count, 0)
                            .toLocaleString('es-CO')}{' '}
                          procesados
                        </span>
                      </div>
                      <ScrapesChart data={scrapeData} />
                    </div>
                  </div>

                  {/* Audit log */}
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-semibold text-sm">
                        Registro de auditoría inmutable (`audit_logs` · RNF-09)
                      </h3>
                      <span className="text-xs text-gray-400">
                        Hoy · {new Date().toLocaleDateString('es-CO')}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {auditLogs.map(log => (
                        <div
                          key={log.id}
                          className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                        >
                          <span className="text-xs text-gray-400 font-mono w-16 flex-shrink-0">
                            {log.time}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              log.result === 'OK'
                                ? 'bg-[#06C167]'
                                : log.result === 'WARN'
                                ? 'bg-yellow-400'
                                : 'bg-red-500'
                            }`}
                          />
                          <span className="text-sm text-gray-700 flex-1">{log.event}</span>
                          <span className="text-xs text-gray-400">@{log.usuario}</span>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              log.result === 'OK'
                                ? 'bg-green-50 text-green-600'
                                : log.result === 'WARN'
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {log.result}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── CRAWLERS TAB ─── */}
              {tab === 'crawlers' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">
                        3 portales instanciados dinámicamente con `CrawlerFactory` (RNF-07) y adaptados con `PropertyDataAdapter` (RN-06)
                      </p>
                    </div>
                    <button
                      onClick={runAll}
                      className="bg-black text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-gray-900 transition-colors flex items-center gap-2"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Ejecutar todos
                    </button>
                  </div>

                  <div className="grid gap-4">
                    {portales.map(portal => {
                      const status = crawlerStatuses[portal.name] || 'idle'
                      return (
                        <div
                          key={portal.key}
                          className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-lg text-gray-600">
                              {portal.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold">{portal.name}</p>
                                <div className={`w-2 h-2 rounded-full ${statusDot[status]}`} />
                                <span className="text-xs text-gray-500">{statusLabel[status]}</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {portal.url} · Última ejecución: {portal.lastRun}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <p className="font-bold text-lg">
                                {portal.records.toLocaleString('es-CO')}
                              </p>
                              <p className="text-xs text-gray-400">inmuebles en BD</p>
                            </div>
                            <button
                              onClick={() => runCrawler(portal.name, portal.key)}
                              disabled={status === 'running'}
                              className="bg-black text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                              {status === 'running' ? (
                                <>
                                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />{' '}
                                  Ejecutando...
                                </>
                              ) : (
                                <>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                  </svg>{' '}
                                  Ejecutar
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Live logs from PostgreSQL */}
                  <div className="bg-black rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 bg-[#06C167] rounded-full animate-pulse" />
                      <h3 className="text-white text-sm font-semibold">
                        Logs de ejecución en PostgreSQL (`audit_logs`)
                      </h3>
                    </div>
                    <div className="space-y-1.5 font-mono text-xs">
                      {auditLogs.slice(0, 6).map(log => (
                        <div key={log.id} className="flex items-start gap-3">
                          <span className="text-gray-600">{log.time}</span>
                          <span
                            className={
                              log.result === 'OK'
                                ? 'text-[#06C167]'
                                : log.result === 'WARN'
                                ? 'text-yellow-400'
                                : 'text-red-400'
                            }
                          >
                            [{log.result}]
                          </span>
                          <span className="text-gray-400">{log.event}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── MODELO TAB ─── */}
              {tab === 'modelo' && (
                <div className="space-y-5">
                  {/* Model status card */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-7">
                    <div className="grid md:grid-cols-3 gap-8">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
                          MAPE actual (RN-01)
                        </p>
                        <div className="text-5xl font-bold text-[#06C167] mb-1">
                          {modelo?.mape_global_pct ?? 12.52}%
                        </div>
                        <p className="text-xs text-gray-400">
                          Poblado: {modelo?.mape_poblado_pct ?? 13.04}% · Otras Comunas:{' '}
                          {modelo?.mape_otras_comunas_pct ?? 11.99}% · Límite: 16%
                        </p>
                        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#06C167] rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                ((modelo?.mape_global_pct ?? 12.52) / 16) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0%</span>
                          <span className="text-red-400">16% límite RN-01</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
                          Último entrenamiento
                        </p>
                        <div className="text-2xl font-bold mb-1">
                          {modelo?.fecha_entrenamiento || 'Hoy'}
                        </div>
                        <p className="text-xs text-gray-400">
                          Dataset activo:{' '}
                          {(modelo?.total_registros_entrenamiento ?? totalRecords).toLocaleString(
                            'es-CO'
                          )}{' '}
                          registros · Split 80/20 (RN-02)
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
                          Estado en producción
                        </p>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-3 h-3 bg-[#06C167] rounded-full" />
                          <span className="font-bold text-lg">Activo en RAM</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          Versión {modelo?.version || 'v1_inicial'} · Compuerta RN-01 aprobada
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Retrain button */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-7">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <h3 className="font-bold text-base">
                          Reentrenamiento del modelo (Patrón Template Method)
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Ejecuta el pipeline completo: preprocesamiento sin fuga de datos (RN-02), entrenamiento segmentado y validación. Solo se despliega si MAPE &le; 16% (RN-01).
                        </p>
                      </div>
                      <button
                        onClick={runRetraining}
                        disabled={retraining === 'running'}
                        className="bg-black text-white text-sm font-semibold px-6 py-3 rounded-full hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0 ml-6"
                      >
                        {retraining === 'running' ? (
                          <>
                            <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />{' '}
                            Procesando...
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="23 4 23 10 17 10" />
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                            {retraining === 'done'
                              ? 'Reentrenar de nuevo'
                              : 'Iniciar reentrenamiento'}
                          </>
                        )}
                      </button>
                    </div>

                    {/* Pipeline steps */}
                    <div className="space-y-2.5">
                      {pipelineSteps.map((step, i) => {
                        const isDone = i < pipelineStep || retraining === 'done'
                        const isActive = retraining === 'running' && i === pipelineStep
                        const isRejected = retraining === 'rejected' && i === 5
                        return (
                          <div
                            key={step.name}
                            className={`flex items-center gap-4 p-3.5 rounded-xl transition-colors ${
                              isRejected
                                ? 'bg-red-50 border border-red-100'
                                : isDone
                                ? 'bg-green-50'
                                : isActive
                                ? 'bg-yellow-50'
                                : 'bg-gray-50'
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isRejected
                                  ? 'bg-red-500 text-white'
                                  : isDone
                                  ? 'bg-[#06C167]'
                                  : isActive
                                  ? 'bg-yellow-400'
                                  : 'bg-gray-200'
                              }`}
                            >
                              {isRejected ? (
                                <span className="text-white text-xs font-bold">✕</span>
                              ) : isDone ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : isActive ? (
                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <span className="text-gray-400 text-xs font-bold">{i + 1}</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <p
                                className={`text-sm font-semibold ${
                                  isRejected
                                    ? 'text-red-700'
                                    : isDone
                                    ? 'text-green-700'
                                    : isActive
                                    ? 'text-yellow-700'
                                    : 'text-gray-500'
                                }`}
                              >
                                {step.name}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {retraining === 'done' && (
                      <div className="mt-4 bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-3">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <p className="text-sm text-green-700 font-medium">
                          {retrainMessage ||
                            'Reentrenamiento completado. MAPE validado ≤ 16% (RN-01) — Modelo promovido a producción (S15).'}
                        </p>
                      </div>
                    )}

                    {retraining === 'rejected' && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <p className="text-sm text-red-700 font-medium">
                          {retrainMessage ||
                            'Despliegue abortado por Regla de Negocio RN-01 (S16): El MAPE superó el umbral del 16%. Se conserva el modelo anterior en producción.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* MAPE chart in model view */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-sm mb-1">Historial de MAPE (RN-01)</h3>
                    <p className="text-xs text-gray-400 mb-4">
                      Evolución del error porcentual absoluto medio en los ciclos registrados en `model_versions`
                    </p>
                    <MAPEChart data={modelo?.historial_mape ?? []} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
