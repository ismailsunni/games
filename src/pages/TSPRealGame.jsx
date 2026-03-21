import { useState, useEffect, useRef, useCallback } from 'react'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { fromLonLat, transformExtent } from 'ol/proj'
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style'
import { supabase } from '../lib/supabase'
import 'ol/ol.css'

// ── TSP Solver (Held-Karp) ───────────────────────────────────────────────────
// Works on any distance matrix (real road distances here)
function solveHeldKarp(distMatrix, n) {
  const INF  = 1e12
  const size = 1 << n
  const dp   = Array.from({ length: size }, () => new Array(n).fill(INF))
  const prev = Array.from({ length: size }, () => new Array(n).fill(-1))
  dp[1][0] = 0

  for (let mask = 1; mask < size; mask++) {
    for (let u = 0; u < n; u++) {
      if (!(mask & (1 << u))) continue
      if (dp[mask][u] === INF) continue
      for (let v = 0; v < n; v++) {
        if (mask & (1 << v)) continue
        const nm = mask | (1 << v)
        const nc = dp[mask][u] + distMatrix[u][v]
        if (nc < dp[nm][v]) { dp[nm][v] = nc; prev[nm][v] = u }
      }
    }
  }

  const full = size - 1
  let best = INF, last = -1
  for (let u = 1; u < n; u++) {
    const c = dp[full][u] + distMatrix[u][0]
    if (c < best) { best = c; last = u }
  }

  const route = []
  let mask = full, cur = last
  while (cur !== -1) {
    route.push(cur)
    const p = prev[mask][cur]
    mask ^= (1 << cur)
    cur = p
  }
  route.reverse()
  route.push(0)
  return { route, cost: best }
}

function routeCost(distMatrix, route) {
  let c = 0
  for (let i = 0; i < route.length - 1; i++) c += distMatrix[route[i]][route[i + 1]]
  return c
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const DIFFICULTIES = { 3: 'Easy', 4: 'Easy+', 5: 'Medium', 6: 'Hard', 7: 'Expert' }

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const LJ_CENTER  = fromLonLat([14.5058, 46.0511])
const LJ_EXTENT  = transformExtent([14.41, 45.98, 14.62, 46.12], 'EPSG:4326', 'EPSG:3857')

// ── Map component ─────────────────────────────────────────────────────────────
function GameMap({ landmarks, userRoute, onLandmarkClick, phase }) {
  const mapRef    = useRef(null)
  const olMapRef  = useRef(null)
  const routeSrc  = useRef(new VectorSource())
  const markerSrc = useRef(new VectorSource())

  // Init map once
  useEffect(() => {
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
            attributions: '© CARTO © OSM contributors',
          })
        }),
        new VectorLayer({ source: routeSrc.current, zIndex: 1 }),
        new VectorLayer({ source: markerSrc.current, zIndex: 2 }),
      ],
      view: new View({
        center: LJ_CENTER,
        zoom: 13,
        minZoom: 11,
        maxZoom: 18,
        extent: LJ_EXTENT,
      }),
    })

    map.on('click', (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, f => f)
      if (feature?.get('lmId') !== undefined) {
        onLandmarkClick(feature.get('lmIdx'))
      }
    })

    map.on('pointermove', (e) => {
      const hit = map.hasFeatureAtPixel(e.pixel, { layerFilter: l => l.getZIndex() === 2 })
      map.getTargetElement().style.cursor = hit ? 'pointer' : ''
    })

    olMapRef.current = map
    return () => map.setTarget(null)
  }, []) // eslint-disable-line

  // Update markers when landmarks/route changes
  useEffect(() => {
    if (!landmarks.length) return
    markerSrc.current.clear()
    routeSrc.current.clear()

    const n         = landmarks.length
    const allVisited = userRoute.length === n
    const startIdx  = userRoute[0]

    landmarks.forEach((lm, idx) => {
      const visited   = userRoute.includes(idx)
      const isCurrent = userRoute[userRoute.length - 1] === idx
      const isStart   = idx === startIdx
      const canClose  = allVisited && isStart && phase === 'playing'

      let fill = '#f9fafb', stroke = '#6b7280', textColor = '#374151'
      if (phase === 'playing') {
        if (canClose)       { fill = '#22c55e'; stroke = '#16a34a'; textColor = '#fff' }
        else if (isCurrent) { fill = '#e63946'; stroke = '#c81d28'; textColor = '#fff' }
        else if (visited)   { fill = '#fee2e2'; stroke = '#fca5a5'; textColor = '#e63946' }
        else                { fill = '#fff';    stroke = '#6366f1' }
      }

      const visitOrder = userRoute.indexOf(idx)
      const label = visitOrder > 0 ? String(visitOrder) : lm.name.split(' ')[0]

      const f = new Feature({ geometry: new Point(fromLonLat([lm.lon, lm.lat])) })
      f.set('lmIdx', idx)
      f.set('lmId', lm.id)
      f.setStyle(new Style({
        image: new CircleStyle({
          radius: 12,
          fill:   new Fill({ color: fill }),
          stroke: new Stroke({ color: stroke, width: 2.5 }),
        }),
        text: new Text({
          text: label,
          font: 'bold 10px sans-serif',
          fill: new Fill({ color: textColor }),
        }),
      }))
      markerSrc.current.addFeature(f)
    })

    // Draw route segments
    for (let i = 0; i < userRoute.length - 1; i++) {
      const a = landmarks[userRoute[i]]
      const b = landmarks[userRoute[i + 1]]
      const line = new Feature({
        geometry: new LineString([fromLonLat([a.lon, a.lat]), fromLonLat([b.lon, b.lat])])
      })
      line.setStyle(new Style({
        stroke: new Stroke({ color: '#e63946', width: 3.5, lineCap: 'round' })
      }))
      routeSrc.current.addFeature(line)
    }
  }, [landmarks, userRoute, phase])

  return <div ref={mapRef} className="w-full h-full" />
}

// ── Storage ───────────────────────────────────────────────────────────────────
function loadStats() {
  try { return JSON.parse(localStorage.getItem('tsp_real_stats')) || { played: 0, optimal: 0, best: 0, total: 0 } }
  catch { return { played: 0, optimal: 0, best: 0, total: 0 } }
}
function saveStats(s) { localStorage.setItem('tsp_real_stats', JSON.stringify(s)) }

// ── Main Game ─────────────────────────────────────────────────────────────────
export default function TSPRealGame() {
  const [allLandmarks, setAllLandmarks]   = useState([])
  const [landmarks, setLandmarks]         = useState([])
  const [distMatrix, setDistMatrix]       = useState([])
  const [nodeCount, setNodeCount]         = useState(5)
  const [phase, setPhase]                 = useState('lobby') // lobby | loading | playing | result
  const [userRoute, setUserRoute]         = useState([])
  const [optimal, setOptimal]             = useState(null)
  const [stats, setStats]                 = useState(() => loadStats())
  const [loadError, setLoadError]         = useState('')
  const [showStats, setShowStats]         = useState(false)

  // Load all landmarks once
  useEffect(() => {
    supabase.rpc('get_landmarks').then(({ data, error }) => {
      if (error) { setLoadError('Failed to load landmarks: ' + error.message); return }
      setAllLandmarks(data)
    })
  }, [])

  // Pick random landmarks and fetch distances
  const startGame = useCallback(async (count = nodeCount) => {
    if (allLandmarks.length === 0) return
    setPhase('loading')
    setUserRoute([])
    setLoadError('')

    const picked = shuffle(allLandmarks).slice(0, count)
    const ids = picked.map(l => l.id)

    const { data, error } = await supabase.rpc('get_tsp_distances', { landmark_ids: ids })
    if (error) { setLoadError('Routing error: ' + error.message); setPhase('lobby'); return }

    // Build n×n distance matrix indexed by position in `picked`
    const n = picked.length
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0))
    data.forEach(row => {
      const fi = picked.findIndex(l => l.id === row.from_landmark)
      const ti = picked.findIndex(l => l.id === row.to_landmark)
      if (fi >= 0 && ti >= 0) matrix[fi][ti] = row.cost_m
    })

    const opt = solveHeldKarp(matrix, n)
    setLandmarks(picked)
    setDistMatrix(matrix)
    setOptimal(opt)
    setPhase('playing')
  }, [allLandmarks, nodeCount])

  function handleLandmarkClick(idx) {
    if (phase !== 'playing') return
    const n = landmarks.length

    if (userRoute.length === 0) { setUserRoute([idx]); return }

    const startIdx   = userRoute[0]
    const allVisited = userRoute.length === n

    if (allVisited && idx === startIdx) {
      const final = [...userRoute, startIdx]
      setUserRoute(final)
      finishGame(final)
      return
    }

    if (userRoute.includes(idx)) return
    setUserRoute(prev => [...prev, idx])
  }

  function finishGame(finalRoute) {
    const userCost   = routeCost(distMatrix, finalRoute)
    const efficiency = Math.round((optimal.cost / userCost) * 100)
    const isOptimal  = Math.abs(userCost - optimal.cost) < 1

    const ns = loadStats()
    ns.played++
    if (isOptimal) ns.optimal++
    if (efficiency > ns.best) ns.best = efficiency
    ns.total += efficiency
    saveStats(ns)
    setStats(ns)
    setPhase('result')
  }

  function handleUndo() {
    setUserRoute(prev => prev.slice(0, -1))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const n          = landmarks.length
  const allVisited = userRoute.length === n
  const canClose   = allVisited && userRoute.length > 0
  const currentCost = userRoute.length >= 2 ? Math.round(routeCost(distMatrix, userRoute)) : 0

  return (
    <div className="h-screen flex flex-col bg-paper font-body">
      {/* Header */}
      <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-2 shrink-0 z-10">
        <a href="#/" className="text-ink/50 hover:text-accent text-sm font-medium shrink-0">← Back</a>
        <h1 className="font-display text-lg font-bold text-ink flex-1">🗺️ TSP Ljubljana</h1>
        <button onClick={() => setShowStats(true)}
          className="text-sm text-ink/50 hover:text-accent font-medium border border-ink/20 px-3 py-1.5 rounded-lg hover:border-accent shrink-0">
          📊 Stats
        </button>
        {phase === 'playing' && (
          <button onClick={() => setPhase('lobby')}
            className="text-sm text-ink/50 hover:text-red-400 border border-ink/20 px-3 py-1.5 rounded-lg hover:border-red-300 shrink-0">
            Give up
          </button>
        )}
      </header>

      {/* Map */}
      <div className="flex-1 relative overflow-hidden">
        <GameMap
          landmarks={landmarks}
          userRoute={userRoute}
          onLandmarkClick={handleLandmarkClick}
          phase={phase}
        />

        {/* Lobby overlay */}
        {phase === 'lobby' && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
              <div className="text-center">
                <div className="text-4xl mb-1">🏙️</div>
                <h2 className="font-display text-xl font-bold text-ink">TSP Ljubljana</h2>
                <p className="text-xs text-ink/50 mt-1">Find the shortest route through real Ljubljana streets</p>
              </div>

              {loadError && <p className="text-xs text-red-500 text-center">{loadError}</p>}

              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Landmarks</span>
                  <span className="text-xs font-bold text-accent">{DIFFICULTIES[nodeCount]}</span>
                </div>
                <div className="flex gap-1.5">
                  {[3,4,5,6,7].map(n => (
                    <button key={n} onClick={() => setNodeCount(n)}
                      className={['flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
                        nodeCount === n ? 'bg-ink text-paper border-ink' : 'bg-white text-ink/60 border-ink/20 hover:border-ink/40'].join(' ')}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-ink/40 text-center">
                {allLandmarks.length > 0 ? `${allLandmarks.length} Ljubljana landmarks loaded` : 'Loading landmarks…'}
              </p>

              <button onClick={() => startGame(nodeCount)}
                disabled={allLandmarks.length === 0}
                className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40">
                Play →
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {phase === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 text-center shadow-2xl">
              <div className="text-3xl mb-2 animate-pulse">🗺️</div>
              <p className="text-sm text-ink/60">Calculating road distances…</p>
            </div>
          </div>
        )}

        {/* Playing HUD */}
        {phase === 'playing' && (
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm border border-ink/10 rounded-xl px-3 py-2 shadow-sm text-sm text-ink/70">
              {userRoute.length === 0 && 'Tap a landmark to start'}
              {userRoute.length > 0 && !allVisited && (
                <span><strong className="text-ink">{n - userRoute.length}</strong> more to visit</span>
              )}
              {canClose && <span className="text-green-600 font-medium">Tap start to finish ✓</span>}
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              {currentCost > 0 && (
                <div className="bg-white/90 backdrop-blur-sm border border-ink/10 rounded-xl px-3 py-2 shadow-sm text-center">
                  <div className="text-[10px] text-ink/40 leading-none">Distance</div>
                  <div className="text-sm font-bold text-accent">{(currentCost/1000).toFixed(1)} km</div>
                </div>
              )}
              {userRoute.length > 0 && (
                <button onClick={handleUndo}
                  className="bg-white/90 backdrop-blur-sm border border-ink/10 rounded-xl px-3 py-2 shadow-sm text-ink/60 hover:text-ink">
                  ↩
                </button>
              )}
            </div>
          </div>
        )}

        {/* Result overlay */}
        {phase === 'result' && optimal && (() => {
          const userCost   = Math.round(routeCost(distMatrix, userRoute))
          const efficiency = Math.round((optimal.cost / userCost) * 100)
          const isOptimal  = Math.abs(userCost - optimal.cost) < 1
          let verdict, verdictColor
          if (isOptimal)             { verdict = '🏆 Optimal!';     verdictColor = 'text-green-600' }
          else if (efficiency >= 95) { verdict = '⭐ Near perfect';  verdictColor = 'text-blue-600' }
          else if (efficiency >= 80) { verdict = '👍 Good route';   verdictColor = 'text-accent' }
          else                       { verdict = '🔁 Keep trying';  verdictColor = 'text-ink/60' }

          return (
            <div className="absolute inset-0 flex items-end justify-center pb-6 bg-ink/30 backdrop-blur-[2px] p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4">
                <div className="text-center">
                  <div className={`text-xl font-bold ${verdictColor}`}>{verdict}</div>
                  <div className="text-xs text-ink/50 mt-0.5">Score: {efficiency}% efficiency</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center text-sm">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <div className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-1">Your route</div>
                    <div className="text-xl font-bold text-red-600">{(userCost/1000).toFixed(2)} km</div>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                    <div className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Optimal</div>
                    <div className="text-xl font-bold text-green-600">{(optimal.cost/1000).toFixed(2)} km</div>
                  </div>
                </div>
                <div className="w-full bg-ink/10 rounded-full h-2.5">
                  <div className="h-full bg-gradient-to-r from-red-400 to-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(efficiency, 100)}%` }} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => startGame(nodeCount)}
                    className="flex-1 bg-accent text-white font-bold py-3 rounded-xl hover:opacity-90">
                    Play again
                  </button>
                  <button onClick={() => setPhase('lobby')}
                    className="flex-1 border border-ink/20 text-ink font-medium py-3 rounded-xl hover:border-accent hover:text-accent">
                    Change map
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Stats modal */}
      {showStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
          onClick={() => setShowStats(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-ink">Stats</h2>
              <button onClick={() => setShowStats(false)} className="text-ink/40 hover:text-ink text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Games played', value: stats.played,               color: 'text-ink' },
                { label: 'Optimal',      value: stats.optimal,              color: 'text-green-600' },
                { label: 'Best score',   value: `${stats.best}%`,           color: 'text-accent' },
                { label: 'Avg score',    value: `${stats.played > 0 ? Math.round(stats.total / stats.played) : 0}%`, color: 'text-blue-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-paper rounded-xl p-3">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-ink/50 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink/40 text-center">Real road distances · Ljubljana, Slovenia</p>
          </div>
        </div>
      )}
    </div>
  )
}
