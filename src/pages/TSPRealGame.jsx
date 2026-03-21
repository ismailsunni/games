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
import GeoJSON from 'ol/format/GeoJSON'
import { fromLonLat, transformExtent } from 'ol/proj'
import { boundingExtent } from 'ol/extent'
import { Attribution } from 'ol/control'
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
const DIFFICULTIES = { 3: 'Easy', 4: 'Easy+', 5: 'Medium', 6: 'Medium+', 7: 'Hard', 8: 'Hard+', 9: 'Expert', 10: 'Extreme' }

const MODE_MAX_NODES = { landmarks: 7, random: 10 }

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

const CITY_CONFIG = {
  ljubljana: {
    label: 'Ljubljana',
    flag: '🇸🇮',
    center: [14.5058, 46.0511],
    bounds: [14.41, 45.98, 14.62, 46.12],
    rpcs: {
      getLandmarks: 'get_landmarks',
      getTspDistances: 'get_tsp_distances',
      getRouteGeojson: 'get_route_geojson',
      getRandomPoints: 'get_random_road_points',
      getRandomDistances: 'get_random_point_distances',
      getVertexRoute: 'get_vertex_route_geojson',
    }
  },
  munich: {
    label: 'München',
    flag: '🇩🇪',
    center: [11.576, 48.137],
    bounds: [11.41, 48.06, 11.72, 48.22],
    rpcs: {
      getLandmarks: 'get_munich_landmarks',
      getTspDistances: 'get_munich_tsp_distances',
      getRouteGeojson: 'get_munich_route_geojson',
      getRandomPoints: 'get_munich_random_points',
      getRandomDistances: 'get_munich_random_distances',
      getVertexRoute: 'get_munich_vertex_route',
    }
  }
}

// Singleton GeoJSON format instance for parsing
const geojsonFormat = new GeoJSON()

// ── Map component ─────────────────────────────────────────────────────────────
function GameMap({ landmarks, userRoute, optRoute, onLandmarkClick, phase, routeGeomMap, olMapRef: olMapRefProp, city }) {
  const mapRef       = useRef(null)
  const olMapRef     = useRef(null)
  const routeSrc     = useRef(new VectorSource())
  const markerSrc    = useRef(new VectorSource())
  // Keep callback ref fresh so OL click handler always calls latest version
  const onClickRef   = useRef(onLandmarkClick)
  useEffect(() => { onClickRef.current = onLandmarkClick }, [onLandmarkClick])

  // Init map once
  useEffect(() => {
    const map = new Map({
      target: mapRef.current,
      controls: [new Attribution({ collapsible: true })],
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
        minZoom: 10,
        maxZoom: 18,
      }),
    })

    map.on('click', (e) => {
      // Skip ring features (no lmId) — find first actual landmark marker
      const feature = map.forEachFeatureAtPixel(
        e.pixel,
        f => f.get('lmId') !== undefined ? f : null,
        { hitTolerance: 8 }
      )
      if (feature?.get('lmId') !== undefined) {
        onClickRef.current(feature.get('lmIdx'))
      }
    })

    map.on('pointermove', (e) => {
      const hit = map.hasFeatureAtPixel(e.pixel, { layerFilter: l => l.getZIndex() === 2 })
      map.getTargetElement().style.cursor = hit ? 'pointer' : ''
    })

    olMapRef.current = map
    if (olMapRefProp) olMapRefProp.current = map
    return () => map.setTarget(null)
  }, []) // eslint-disable-line

  // Pan to city whenever city prop changes (or on first render)
  useEffect(() => {
    if (!olMapRef.current) return
    const cfg = CITY_CONFIG[city]
    const extent = transformExtent(cfg.bounds, 'EPSG:4326', 'EPSG:3857')
    olMapRef.current.getView().fit(extent, {
      size: olMapRef.current.getSize() || [375, 600],
      duration: 500,
    })
  }, [city])

  // Update markers when landmarks/route/geoms changes
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
          radius: 20,
          fill:   new Fill({ color: fill }),
          stroke: new Stroke({ color: stroke, width: 2.5 }),
        }),
        text: new Text({
          text: label,
          font: 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fill: new Fill({ color: textColor }),
        }),
      }))
      markerSrc.current.addFeature(f)


    })

    // Draw user route — red (real street geometry when available, dashed straight line as placeholder)
    for (let i = 0; i < userRoute.length - 1; i++) {
      const fromLm = landmarks[userRoute[i]]
      const toLm   = landmarks[userRoute[i + 1]]
      const segKey = `${fromLm.id}-${toLm.id}`
      const revKey = `${toLm.id}-${fromLm.id}`
      const geojsonStr = routeGeomMap[segKey] || routeGeomMap[revKey]

      let line
      if (geojsonStr) {
        try {
          const olGeom = geojsonFormat.readGeometry(geojsonStr, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          })
          line = new Feature({ geometry: olGeom })
          line.setStyle(new Style({
            stroke: new Stroke({ color: '#e63946', width: 4, lineCap: 'round' })
          }))
        } catch (e) {
          // fall through to straight-line placeholder
        }
      }

      if (!line) {
        // Placeholder: thin dashed straight line
        line = new Feature({
          geometry: new LineString([fromLonLat([fromLm.lon, fromLm.lat]), fromLonLat([toLm.lon, toLm.lat])])
        })
        line.setStyle(new Style({
          stroke: new Stroke({ color: '#e63946', width: 2, lineDash: [6, 4] })
        }))
      }

      routeSrc.current.addFeature(line)
    }

    // Draw optimal route — green dashed (result only)
    if (phase === 'result' && optRoute?.length) {
      for (let i = 0; i < optRoute.length - 1; i++) {
        const fromLm = landmarks[optRoute[i]]
        const toLm   = landmarks[optRoute[i + 1]]
        const segKey = `${fromLm.id}-${toLm.id}`
        const revKey = `${toLm.id}-${fromLm.id}`
        // Roads are undirected — accept geometry cached in either direction
        const geojsonStr = routeGeomMap[segKey] || routeGeomMap[revKey]

        let line
        if (geojsonStr) {
          try {
            const olGeom = geojsonFormat.readGeometry(geojsonStr, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857',
            })
            line = new Feature({ geometry: olGeom })
            line.setStyle(new Style({
              stroke: new Stroke({ color: '#22c55e', width: 4, lineCap: 'round', lineDash: [8, 4] })
            }))
          } catch (e) {
            // fall through to straight-line placeholder
          }
        }

        if (!line) {
          line = new Feature({
            geometry: new LineString([fromLonLat([fromLm.lon, fromLm.lat]), fromLonLat([toLm.lon, toLm.lat])])
          })
          line.setStyle(new Style({
            stroke: new Stroke({ color: '#22c55e', width: 2, lineDash: [8, 4] })
          }))
        }

        routeSrc.current.addFeature(line)
      }
    }
  }, [landmarks, userRoute, optRoute, phase, routeGeomMap])

  return <div ref={mapRef} className="w-full h-full" />
}

// ── Storage ───────────────────────────────────────────────────────────────────
const DEFAULT_BY_COUNT = {
  3: { played: 0, qualified: 0 },
  4: { played: 0, qualified: 0 },
  5: { played: 0, qualified: 0 },
  6: { played: 0, qualified: 0 },
  7: { played: 0, qualified: 0 },
  8: { played: 0, qualified: 0 },
  9: { played: 0, qualified: 0 },
}
function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem('tsp_real_stats')) || { played: 0, optimal: 0, best: 0, total: 0 }
    if (!s.byCount) s.byCount = JSON.parse(JSON.stringify(DEFAULT_BY_COUNT))
    return s
  } catch { return { played: 0, optimal: 0, best: 0, total: 0, byCount: JSON.parse(JSON.stringify(DEFAULT_BY_COUNT)) } }
}
function saveStats(s) { localStorage.setItem('tsp_real_stats', JSON.stringify(s)) }

function getMaxUnlocked(stats) {
  let max = 6  // 3-6 always unlocked
  for (let n = 7; n <= 10; n++) {
    const prev = stats.byCount?.[n - 1] ?? { qualified: 0 }
    if (prev.qualified >= 3) max = n
    else break
  }
  return max
}

function loadSavedGame() {
  try { return JSON.parse(localStorage.getItem('tsp_real_state')) || null }
  catch { return null }
}
function persistGame(state) { localStorage.setItem('tsp_real_state', JSON.stringify(state)) }
function clearSavedGame() { localStorage.removeItem('tsp_real_state') }

// ── Main Game ─────────────────────────────────────────────────────────────────
export default function TSPRealGame() {
  const [allLandmarks, setAllLandmarks]           = useState([])
  const [landmarks, setLandmarks]                 = useState([])
  const [previewLandmarks, setPreviewLandmarks]   = useState([])
  const [previewLoading, setPreviewLoading]       = useState(false)
  const [distMatrix, setDistMatrix]               = useState([])
  const [nodeCount, setNodeCount]                 = useState(5)
  const [mode, setMode]                           = useState('landmarks') // 'landmarks' | 'random'
  const [city, setCity]                           = useState('ljubljana') // 'ljubljana' | 'munich'
  const [phase, setPhase]                         = useState('home') // home | config | loading | playing | result
  const [userRoute, setUserRoute]                 = useState([])
  const [optimal, setOptimal]                     = useState(null)
  const [stats, setStats]                         = useState(() => loadStats())
  const [unlockMessage, setUnlockMessage]         = useState('')
  const [loadError, setLoadError]                 = useState('')
  const [showStats, setShowStats]                 = useState(false)
  const [showHelp, setShowHelp]                   = useState(false)
  const [routeGeomMap, setRouteGeomMap]           = useState({})
  const [resultCollapsed, setResultCollapsed]     = useState(false)
  const [savedGame, setSavedGame]                 = useState(() => loadSavedGame())

  // Map ref exposed upward for zoom-to-fit
  const olMapRef = useRef(null)

  // Cache for geom fetches — persists across renders without causing re-renders
  const geomsCache = useRef({})

  // Keep mode in a ref so fetchSegGeom (useCallback) always sees the latest value
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

  // Keep city in a ref so fetchSegGeom (useCallback) always sees the latest value
  const cityRef = useRef(city)
  useEffect(() => { cityRef.current = city }, [city])

  // Load all landmarks when city changes
  useEffect(() => {
    supabase.rpc(CITY_CONFIG[city].rpcs.getLandmarks).then(({ data, error }) => {
      if (error) { setLoadError('Failed to load landmarks: ' + error.message); return }
      setAllLandmarks(data)
      setPreviewLandmarks(shuffle(data).slice(0, 5))
    })
  }, [city])

  // Re-roll preview when nodeCount or mode changes
  useEffect(() => {
    if (mode === 'landmarks') {
      if (allLandmarks.length > 0) {
        setPreviewLandmarks(shuffle(allLandmarks).slice(0, nodeCount))
      }
    } else {
      // Random mode: pre-fetch random road points
      let cancelled = false
      setPreviewLoading(true)
      setPreviewLandmarks([])
      supabase.rpc(CITY_CONFIG[city].rpcs.getRandomPoints, { n: nodeCount }).then(({ data, error }) => {
        if (cancelled) return
        setPreviewLoading(false)
        if (error || !data) return
        const normalized = data.map((pt, i) => ({
          id: pt.pt_id,
          name: String.fromCharCode(65 + i),
          lat: pt.lat,
          lon: pt.lon,
        }))
        setPreviewLandmarks(normalized)
      })
      return () => { cancelled = true }
    }
  }, [nodeCount, mode, city, allLandmarks])

  // When switching mode, clamp nodeCount to new max
  const handleModeChange = useCallback((newMode) => {
    setMode(newMode)
    const maxNodes = MODE_MAX_NODES[newMode]
    setNodeCount(prev => Math.min(prev, maxNodes))
  }, [])

  // Reset result collapse when entering result phase
  useEffect(() => {
    if (phase === 'result') setResultCollapsed(false)
  }, [phase])

  const rerollLandmarks = useCallback(async () => {
    if (mode === 'landmarks') {
      if (allLandmarks.length > 0) {
        setPreviewLandmarks(shuffle(allLandmarks).slice(0, nodeCount))
      }
    } else {
      setPreviewLoading(true)
      setPreviewLandmarks([])
      const { data, error } = await supabase.rpc(CITY_CONFIG[city].rpcs.getRandomPoints, { n: nodeCount })
      setPreviewLoading(false)
      if (error || !data) return
      const normalized = data.map((pt, i) => ({
        id: pt.pt_id,
        name: String.fromCharCode(65 + i),
        lat: pt.lat,
        lon: pt.lon,
      }))
      setPreviewLandmarks(normalized)
    }
  }, [allLandmarks, nodeCount, mode, city])

  // Fetch segment geometry (real street route) — non-blocking, updates state when ready
  const fetchSegGeom = useCallback(async (fromId, toId) => {
    const key = `${fromId}-${toId}`
    if (geomsCache.current[key]) {
      setRouteGeomMap(prev => prev[key] ? prev : { ...prev, [key]: geomsCache.current[key] })
      return
    }

    let data, error
    const cityRpcs = CITY_CONFIG[cityRef.current].rpcs
    if (modeRef.current === 'landmarks') {
      ({ data, error } = await supabase.rpc(cityRpcs.getRouteGeojson, {
        from_landmark_id: fromId,
        to_landmark_id: toId,
      }))
    } else {
      ({ data, error } = await supabase.rpc(cityRpcs.getVertexRoute, {
        from_vertex_id: fromId,
        to_vertex_id: toId,
      }))
    }
    if (error || !data) return

    geomsCache.current[key] = data
    setRouteGeomMap(prev => ({ ...prev, [key]: data }))
  }, [])

  // Pick random landmarks and fetch distances
  const startGame = useCallback(async (count = nodeCount, pickedOverride = null) => {
    if (mode === 'landmarks' && allLandmarks.length === 0) return
    setPhase('loading')
    setUserRoute([])
    setLoadError('')
    setRouteGeomMap({})
    setUnlockMessage('')
    try {

    let picked
    if (pickedOverride && pickedOverride.length > 0) {
      picked = pickedOverride
    } else if (mode === 'landmarks') {
      picked = shuffle(allLandmarks).slice(0, count)
    } else {
      // random mode — fetch fresh points
      const { data, error } = await supabase.rpc(CITY_CONFIG[city].rpcs.getRandomPoints, { n: count })
      if (error || !data) { setLoadError('Failed to fetch random points: ' + (error?.message || '')); setPhase('config'); return }
      picked = data.map((pt, i) => ({
        id: pt.pt_id,
        name: String.fromCharCode(65 + i),
        lat: pt.lat,
        lon: pt.lon,
      }))
    }

    // Build distance matrix
    const n = picked.length
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0))

    if (mode === 'landmarks') {
      const ids = picked.map(l => l.id)
      const { data, error } = await supabase.rpc(CITY_CONFIG[city].rpcs.getTspDistances, { landmark_ids: ids })
      if (error) { setLoadError('Routing error: ' + error.message); setPhase('config'); return }
      data.forEach(row => {
        const fi = picked.findIndex(l => l.id === row.from_landmark)
        const ti = picked.findIndex(l => l.id === row.to_landmark)
        if (fi >= 0 && ti >= 0) matrix[fi][ti] = row.cost_m
      })
    } else {
      const ids = picked.map(l => Number(l.id)) // BigInt can't be JSON-serialized; Postgres handles number→bigint
      const { data, error } = await supabase.rpc(CITY_CONFIG[city].rpcs.getRandomDistances, { vertex_ids: ids })
      if (error) { setLoadError('Routing error: ' + error.message); setPhase('config'); return }
      data.forEach(row => {
        const fi = picked.findIndex(l => l.id === row.from_vertex)
        const ti = picked.findIndex(l => l.id === row.to_vertex)
        if (fi >= 0 && ti >= 0) matrix[fi][ti] = row.cost_m
      })
    }

    const opt = solveHeldKarp(matrix, n)
    clearSavedGame()
    setSavedGame(null)
    setLandmarks(picked)
    setDistMatrix(matrix)
    setOptimal(opt)
    setPhase('playing')

    // Zoom to fit all landmarks
    setTimeout(() => {
      if (olMapRef.current) {
        const coords = picked.map(lm => fromLonLat([lm.lon, lm.lat]))
        const extent = boundingExtent(coords)
        olMapRef.current.getView().fit(extent, { padding: [80, 40, 120, 40], maxZoom: 15, duration: 600 })
      }
    }, 100)
    } catch (err) {
      setLoadError('Unexpected error: ' + err.message)
      setPhase('config')
    }
  }, [allLandmarks, nodeCount, previewLandmarks, mode, city])

  function handleLandmarkClick(idx) {
    if (phase !== 'playing') return
    const n = landmarks.length

    if (userRoute.length === 0) { setUserRoute([idx]); return }

    const startIdx   = userRoute[0]
    const allVisited = userRoute.length === n
    const currentIdx = userRoute[userRoute.length - 1]

    // Click current (last) node → undo it (but can't undo the very first node if it's the only one)
    if (idx === currentIdx && userRoute.length > 1) {
      setUserRoute(prev => prev.slice(0, -1))
      return
    }

    if (allVisited && idx === startIdx) {
      const final = [...userRoute, startIdx]
      setUserRoute(final)
      finishGame(final)
      return
    }

    if (userRoute.includes(idx)) return

    // Fire-and-forget: fetch real geometry for the new segment
    const prevIdx = userRoute[userRoute.length - 1]
    fetchSegGeom(landmarks[prevIdx].id, landmarks[idx].id)

    setUserRoute(prev => {
      const next = [...prev, idx]
      persistGame({ nodeCount, city, landmarks, distMatrix, optimal, userRoute: next, routeGeomMap })
      return next
    })
  }

  async function finishGame(finalRoute) {
    const userCost   = routeCost(distMatrix, finalRoute)
    const efficiency = Math.round((optimal.cost / userCost) * 100)
    const isOptimal  = Math.abs(userCost - optimal.cost) < 1

    const ns = loadStats()
    const oldStats = JSON.parse(JSON.stringify(ns))
    ns.played++
    if (isOptimal) ns.optimal++
    if (efficiency > ns.best) ns.best = efficiency
    ns.total += efficiency

    const countKey = finalRoute.length - 1
    if (!ns.byCount) ns.byCount = {}
    if (!ns.byCount[countKey]) ns.byCount[countKey] = { played: 0, qualified: 0 }
    ns.byCount[countKey].played++
    if (efficiency >= 90) ns.byCount[countKey].qualified++

    saveStats(ns)
    setStats(ns)

    const newMax = getMaxUnlocked(ns)
    const wasMax = getMaxUnlocked(oldStats)
    if (newMax > wasMax) {
      setUnlockMessage(`🔓 ${newMax} nodes unlocked!`)
    }

    // Fetch all optimal route segment geoms in parallel
    if (optimal?.route?.length) {
      const fetchPromises = []
      for (let i = 0; i < optimal.route.length - 1; i++) {
        const fromLm = landmarks[optimal.route[i]]
        const toLm   = landmarks[optimal.route[i + 1]]
        if (fromLm && toLm) {
          fetchPromises.push(fetchSegGeom(fromLm.id, toLm.id))
        }
      }
      await Promise.all(fetchPromises).catch(() => {/* ignore errors */})
    }

    clearSavedGame()
    setSavedGame(null)
    setPhase('result')
  }

  function handleUndo() {
    setUserRoute(prev => prev.slice(0, -1))
  }

  function continueGame() {
    const sg = savedGame
    if (!sg) return
    setLandmarks(sg.landmarks)
    setDistMatrix(sg.distMatrix)
    setOptimal(sg.optimal)
    setNodeCount(sg.nodeCount)
    if (sg.city) setCity(sg.city)
    setUserRoute(sg.userRoute)
    setRouteGeomMap(sg.routeGeomMap || {})
    setPhase('playing')
    setTimeout(() => {
      if (olMapRef.current) {
        const coords = sg.landmarks.map(lm => fromLonLat([lm.lon, lm.lat]))
        const extent = boundingExtent(coords)
        olMapRef.current.getView().fit(extent, { padding: [80, 40, 120, 40], maxZoom: 15, duration: 600 })
      }
    }, 100)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const maxUnlocked = getMaxUnlocked(stats)
  const n          = landmarks.length
  const allVisited = userRoute.length === n
  const canClose   = allVisited && userRoute.length > 0
  const currentCost = userRoute.length >= 2 ? Math.round(routeCost(distMatrix, userRoute)) : 0

  return (
    <div className="h-screen flex flex-col bg-paper font-body">
      {/* Header */}
      <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-2 shrink-0 z-10">
        <a href="#/" className="text-ink/50 hover:text-accent text-sm font-medium shrink-0">← Gallery</a>
        <h1 className="font-display text-lg font-bold text-ink flex-1">🗺️ TSP {CITY_CONFIG[city].label}</h1>
        {phase !== 'home' && (
          <button onClick={() => setShowStats(true)}
            className="text-sm text-ink/50 hover:text-accent font-medium border border-ink/20 px-3 py-1.5 rounded-lg hover:border-accent shrink-0">
            📊 Stats
          </button>
        )}
        {phase === 'playing' && (
          <button onClick={() => setPhase('home')}
            className="text-sm text-ink/50 hover:text-red-400 border border-ink/20 px-3 py-1.5 rounded-lg hover:border-red-300 shrink-0">
            ≡ Menu
          </button>
        )}
      </header>

      {/* Map */}
      <div className="flex-1 relative overflow-hidden">
        <GameMap
          landmarks={landmarks}
          userRoute={userRoute}
          optRoute={optimal?.route}
          onLandmarkClick={handleLandmarkClick}
          phase={phase}
          routeGeomMap={routeGeomMap}
          olMapRef={olMapRef}
          city={city}
        />

        {/* Home overlay */}
        {phase === 'home' && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-6">
              <div className="text-center">
                <div className="text-5xl mb-2">🗺️</div>
                <h1 className="text-2xl font-bold text-ink">TSP Challenge</h1>
                <p className="text-sm text-ink/50 mt-1">🇸🇮 Ljubljana · 🇩🇪 München</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button onClick={() => setPhase('config')} className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:opacity-90">
                  ▶ New Game
                </button>
                {savedGame && (
                  <button onClick={continueGame} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:opacity-90">
                    ▶ Continue
                    <span className="text-xs font-normal opacity-80 ml-2">({savedGame.landmarks?.length} stops, {savedGame.userRoute?.length - 1} visited)</span>
                  </button>
                )}
                <button onClick={() => setShowStats(true)} className="w-full border border-ink/20 text-ink/70 font-medium py-3 rounded-xl hover:border-accent hover:text-accent">
                  📊 Stats
                </button>
                <button onClick={() => setShowHelp(true)} className="w-full border border-ink/20 text-ink/70 font-medium py-3 rounded-xl hover:border-accent hover:text-accent">
                  ❓ How to Play
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Config overlay */}
        {phase === 'config' && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <button onClick={() => setPhase('home')} className="text-ink/50 hover:text-accent text-sm font-medium">← Back</button>
                <div className="flex-1 text-center">
                  <div className="text-3xl mb-1">🏙️</div>
                  <h2 className="font-display text-xl font-bold text-ink">Configure Game</h2>
                </div>
                <div className="w-12" />
              </div>

              {loadError && <p className="text-xs text-red-500 text-center">{loadError}</p>}

              {/* City selector */}
              <div className="flex flex-col gap-1">
                <div className="text-xs font-semibold text-ink/40 uppercase tracking-wider">City</div>
                <div className="flex gap-2">
                  {[['ljubljana', '🇸🇮 Ljubljana'], ['munich', '🇩🇪 München']].map(([val, label]) => (
                    <button key={val} onClick={() => setCity(val)}
                      className={['flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
                        city === val ? 'bg-ink text-paper border-ink' : 'bg-white text-ink/60 border-ink/20 hover:border-ink/40'].join(' ')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode selector */}
              <div className="flex gap-2">
                {[['landmarks', '📍 Landmarks'], ['random', '🎲 Random']].map(([val, label]) => (
                  <button key={val} onClick={() => handleModeChange(val)}
                    className={['flex-1 py-2 text-sm font-medium rounded-lg border transition-colors',
                      mode === val ? 'bg-ink text-paper border-ink' : 'bg-white text-ink/60 border-ink/20 hover:border-ink/40'].join(' ')}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Node count slider */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">
                    {mode === 'landmarks' ? 'Landmarks' : 'Points'}
                  </span>
                  <span className="text-xs font-bold text-accent">{DIFFICULTIES[nodeCount] || 'nodes'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-ink/40">
                    <span>3</span>
                    <span className="font-bold text-accent text-sm">{nodeCount} {DIFFICULTIES[nodeCount] || 'nodes'}</span>
                    <span>{Math.min(MODE_MAX_NODES[mode], maxUnlocked)}</span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={Math.min(MODE_MAX_NODES[mode], maxUnlocked)}
                    step={1}
                    value={nodeCount}
                    onChange={e => setNodeCount(+e.target.value)}
                    className="w-full accent-accent"
                  />
                  {nodeCount === maxUnlocked && maxUnlocked < Math.min(10, MODE_MAX_NODES[mode]) && (() => {
                    const qualified = stats.byCount?.[nodeCount]?.qualified ?? 0
                    return (
                      <p className="text-[10px] text-ink/40 text-center">
                        🔒 {qualified}/3 wins ≥ 90% at {nodeCount} nodes to unlock {nodeCount + 1}
                      </p>
                    )
                  })()}
                </div>
              </div>

              <p className="text-xs text-ink/40 text-center">
                {mode === 'landmarks'
                  ? (allLandmarks.length > 0 ? `${allLandmarks.length} ${CITY_CONFIG[city].label} landmarks loaded` : 'Loading landmarks…')
                  : `Random road points · ${CITY_CONFIG[city].label}`}
              </p>

              <button onClick={() => startGame(nodeCount, mode === 'landmarks' ? previewLandmarks : null)}
                disabled={mode === 'landmarks' && allLandmarks.length === 0}
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
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
              <div className="bg-white/90 backdrop-blur-sm border border-ink/10 rounded-xl px-3 py-2 shadow-sm text-sm text-ink/70">
                {userRoute.length === 0 && 'Tap a landmark to start'}
                {userRoute.length > 0 && !allVisited && (
                  <span><strong className="text-ink">{n - userRoute.length}</strong> more to visit</span>
                )}
                {canClose && <span className="text-green-600 font-medium">Tap <strong>{landmarks[userRoute[0]]?.name}</strong> to finish ✓</span>}
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
                    className="bg-white/90 backdrop-blur-sm border border-ink/10 rounded-xl px-3 py-2 shadow-sm text-ink/60 hover:text-ink pointer-events-auto">
                    ↩
                  </button>
                )}
              </div>
            </div>

            {userRoute.length > 0 && (
              <div className="absolute bottom-3 left-3 right-3 pointer-events-auto">
                <div className="bg-white/90 backdrop-blur-sm border border-ink/10 rounded-xl px-3 py-2 shadow-sm text-xs text-ink/60 overflow-x-auto whitespace-nowrap">
                  {userRoute.map((idx, i) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-1 text-ink/30">→</span>}
                      <span className={i === userRoute.length - 1 ? 'text-accent font-semibold' : ''}>{landmarks[idx]?.name}</span>
                    </span>
                  ))}
                  {!allVisited && <span className="text-ink/30 ml-1">→ ?</span>}
                  {allVisited && <span className="text-green-600 ml-1">→ {landmarks[userRoute[0]]?.name} ✓</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Result overlay — no background/blur so map stays interactive */}
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
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none pb-6 px-4 flex justify-center">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4 pointer-events-auto">
                {/* Drag handle / collapse toggle */}
                <button onClick={() => setResultCollapsed(c => !c)}
                  className="w-full flex justify-center items-center gap-1 text-xs text-ink/40 hover:text-ink/60 mb-2">
                  <span className="w-8 h-1 rounded-full bg-ink/20 block" />
                </button>

                <div className="text-center">
                  <div className={`text-xl font-bold ${verdictColor}`}>{verdict}</div>
                  <div className="text-xs text-ink/50 mt-0.5">Score: {efficiency}% efficiency</div>
                  {unlockMessage && (
                    <div className="mt-1 text-sm font-bold text-green-600 animate-pulse">{unlockMessage}</div>
                  )}
                </div>

                {!resultCollapsed && <>
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

                <div className="flex justify-center gap-4 text-xs text-ink/60">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-5 h-1 rounded bg-red-400" /> Your route
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-5 h-1 rounded" style={{background: 'repeating-linear-gradient(90deg,#22c55e 0,#22c55e 6px,transparent 6px,transparent 10px)'}} /> Optimal
                  </span>
                </div>

                <div className="text-[10px] text-ink/50 space-y-1">
                  <div><span className="text-red-400 font-semibold">Your:</span> {userRoute.slice(0,-1).map(i => landmarks[i]?.name).join(' → ')} → {landmarks[userRoute[0]]?.name}</div>
                  <div><span className="text-green-600 font-semibold">Optimal:</span> {optimal.route.slice(0,-1).map(i => landmarks[i]?.name).join(' → ')} → {landmarks[optimal.route[0]]?.name}</div>
                </div>
                </>}

                <div className="flex gap-3">
                  <button onClick={() => startGame(nodeCount)}
                    className="flex-1 bg-accent text-white font-bold py-3 rounded-xl hover:opacity-90">
                    Play again
                  </button>
                  <button onClick={() => setPhase('home')}
                    className="flex-1 border border-ink/20 text-ink font-medium py-3 rounded-xl hover:border-accent hover:text-accent">
                    🏠 Home
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
            <div className="border-t border-ink/10 pt-3">
              <div className="text-xs font-semibold text-ink/40 uppercase tracking-wider mb-2">Unlock Progress</div>
              {[7, 8, 9, 10].map(n => {
                const qualified = stats.byCount?.[n - 1]?.qualified ?? 0
                const unlocked = getMaxUnlocked(stats) >= n
                return (
                  <div key={n} className="flex justify-between items-center text-xs py-0.5">
                    <span className={unlocked ? 'text-green-600 font-semibold' : 'text-ink/50'}>
                      {unlocked ? '🔓' : '🔒'} {n} nodes
                    </span>
                    <span className="text-ink/40">
                      {unlocked ? 'Unlocked' : `${qualified}/3 wins ≥90%`}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-ink/40 text-center">Real road distances · {CITY_CONFIG[city].label}</p>
            <button onClick={() => {
              const fresh = { played: 0, optimal: 0, best: 0, total: 0, byCount: JSON.parse(JSON.stringify(DEFAULT_BY_COUNT)) }
              saveStats(fresh)
              setStats(fresh)
            }}
              className="text-xs text-ink/30 hover:text-red-400 transition-colors text-center mt-1">
              Reset stats
            </button>
          </div>
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
          onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-ink">How to Play</h2>
              <button onClick={() => setShowHelp(false)} className="text-ink/40 hover:text-ink text-xl">✕</button>
            </div>
            <ul className="text-sm text-ink/70 space-y-2">
              <li>📍 Tap any landmark to start your route</li>
              <li>🔁 Visit <strong>all</strong> landmarks exactly once</li>
              <li>🏁 Return to your starting landmark to finish</li>
              <li>🎯 Beat the optimal route distance!</li>
              <li>↩ Tap the current node again to undo the last step</li>
              <li>🔓 Get 3 wins ≥ 90% efficiency to unlock more nodes</li>
            </ul>
            <button onClick={() => setShowHelp(false)}
              className="w-full bg-accent text-white font-bold py-2.5 rounded-xl hover:opacity-90 mt-2">
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
