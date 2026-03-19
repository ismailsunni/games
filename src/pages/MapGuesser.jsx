import 'ol/ol.css'
import { useEffect, useRef, useState } from 'react'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import { fromLonLat, toLonLat } from 'ol/proj'
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style'
import Cluster from 'ol/source/Cluster'
import { defaults as defaultInteractions } from 'ol/interaction'
import Overlay from 'ol/Overlay'
import cities from '../data/cities'

const TOTAL_ROUNDS = 5
const ROUND_TIME = 30

const BASEMAPS = {
  nolabels: {
    label: 'Streets',
    url: 'https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
}

const FILTER_LABELS = {
  all: 'All Cities',
  capitals: 'Capital Cities',
  europe: 'Europe',
  indonesia: 'Indonesia',
}

const DEFAULT_STATS = {
  all: { gamesPlayed: 0, bestScore: 0, totalScore: 0 },
  capitals: { gamesPlayed: 0, bestScore: 0, totalScore: 0 },
  europe: { gamesPlayed: 0, bestScore: 0, totalScore: 0 },
  indonesia: { gamesPlayed: 0, bestScore: 0, totalScore: 0 },
}

function loadStats() {
  try {
    const s = localStorage.getItem('mapguesser_stats')
    if (!s) return JSON.parse(JSON.stringify(DEFAULT_STATS))
    const parsed = JSON.parse(s)
    return {
      all: { ...DEFAULT_STATS.all, ...parsed.all },
      capitals: { ...DEFAULT_STATS.capitals, ...parsed.capitals },
      europe: { ...DEFAULT_STATS.europe, ...parsed.europe },
      indonesia: { ...DEFAULT_STATS.indonesia, ...parsed.indonesia },
    }
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_STATS))
  }
}

function saveStats(stats) {
  localStorage.setItem('mapguesser_stats', JSON.stringify(stats))
}

function loadGameState() {
  try {
    const s = localStorage.getItem('mapguesser_state')
    return s ? JSON.parse(s) : null
  } catch {
    return null
  }
}

function saveGameState(state) {
  localStorage.setItem('mapguesser_state', JSON.stringify(state))
}

function clearGameState() {
  localStorage.removeItem('mapguesser_state')
}

function scoreToEmojis(score) {
  const pct = score / 5000
  let emoji
  if (pct >= 0.8) emoji = '💚'
  else if (pct >= 0.6) emoji = '🟩'
  else if (pct >= 0.4) emoji = '🟨'
  else if (pct >= 0.2) emoji = '🟧'
  else emoji = '🟥'
  const filled = Math.min(5, Math.round(score / 1000))
  return emoji.repeat(filled) + '⬜'.repeat(5 - filled)
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function calcScore(distKm, filter = 'all') {
  // Smaller regions use tighter max distance for meaningful scoring
  const maxDist = filter === 'indonesia' ? 2000 : filter === 'europe' ? 2500 : 10000
  return Math.max(0, Math.round(5000 * (1 - distKm / maxDist)))
}

function filterCities(filter) {
  if (filter === 'capitals') return cities.filter((c) => c.capital)
  if (filter === 'indonesia') return cities.filter((c) => c.indonesia)
  if (filter === 'europe') return cities.filter((c) => c.continent === 'Europe')
  return cities
}

// Min zoom per filter
function getMinZoom(filter) {
  return filter === 'indonesia' ? 11 : 10
}

function pickCities(count, pool) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function makeGuessPinStyle() {
  return new Style({
    image: new CircleStyle({
      radius: 10,
      fill: new Fill({ color: '#3b82f6' }),
      stroke: new Stroke({ color: '#fff', width: 2.5 }),
    }),
  })
}

function makeActualPinStyle() {
  return new Style({
    image: new CircleStyle({
      radius: 10,
      fill: new Fill({ color: '#ef4444' }),
      stroke: new Stroke({ color: '#fff', width: 2.5 }),
    }),
  })
}

function makeLineStyle() {
  return new Style({
    stroke: new Stroke({
      color: '#f97316',
      width: 2,
      lineDash: [8, 6],
    }),
  })
}

export default function MapGuesser() {
  const questionMapRef = useRef(null)
  const guessMapRef = useRef(null)
  const explorerMapRef = useRef(null)
  const questionMapInstance = useRef(null)
  const guessMapInstance = useRef(null)
  const explorerMapInstance = useRef(null)
  const explorerCityVecSource = useRef(null)
  const qTileLayerRef = useRef(null)
  const gTileLayerRef = useRef(null)
  const guessVectorSource = useRef(null)
  const guessLayerRef = useRef(null)
  const cityPinSource = useRef(null)
  const mapsInitialized = useRef(false)

  const [basemap, setBasemap] = useState('nolabels')
  const [zoom] = useState(15)
  const [filter, setFilter] = useState('all')
  const MIN_ZOOM = getMinZoom(filter)
  const [phase, setPhase] = useState('lobby') // lobby | question | guessing | result | gameover | explorer
  const [explorerFilter, setExplorerFilter] = useState('all')
  const [popup, setPopup] = useState(null) // {name, country}
  const explorerPopupRef = useRef(null)   // DOM element for OL Overlay
  const explorerOverlayRef = useRef(null) // OL Overlay instance
  const [roundCities, setRoundCities] = useState(null)
  const [currentRound, setCurrentRound] = useState(0)
  const [guessCoord, setGuessCoord] = useState(null) // [lng, lat]
  const [results, setResults] = useState([])
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
  const [stats, setStats] = useState(() => loadStats())
  const [savedState, setSavedState] = useState(() => loadGameState())
  const [shareStatus, setShareStatus] = useState(null) // null | 'copied'

  // Persist game state on every relevant state change
  useEffect(() => {
    if (phase === 'question' || phase === 'guessing' || phase === 'result') {
      if (roundCities) {
        saveGameState({ filter, roundCities, currentRound, results, phase })
      }
    }
  }, [phase, currentRound, results, roundCities, filter])

  // Init maps when game starts (roundCities first set)
  useEffect(() => {
    if (!roundCities || mapsInitialized.current) return
    mapsInitialized.current = true

    const qTileLayer = new TileLayer({
      source: new XYZ({ url: BASEMAPS.nolabels.url }),
    })
    qTileLayerRef.current = qTileLayer

    // City center pin on question map
    const pinSource = new VectorSource()
    cityPinSource.current = pinSource
    const city = roundCities[currentRound] || roundCities[0]
    const pinFeature = new Feature({ geometry: new Point(fromLonLat([city.lng, city.lat])) })
    pinFeature.setStyle(new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: '#f97316' }),
        stroke: new Stroke({ color: '#fff', width: 2.5 }),
      }),
    }))
    pinSource.addFeature(pinFeature)
    const pinLayer = new VectorLayer({ source: pinSource })

    const qMap = new Map({
      target: questionMapRef.current,
      layers: [qTileLayer, pinLayer],
      interactions: defaultInteractions(),
      controls: [],
      view: new View({
        center: fromLonLat([city.lng, city.lat]),
        zoom: zoom,
        minZoom: MIN_ZOOM,
        maxZoom: 19,
      }),
    })
    questionMapInstance.current = qMap

    const gTileLayer = new TileLayer({
      source: new XYZ({ url: BASEMAPS.nolabels.url }),
    })
    gTileLayerRef.current = gTileLayer

    const vSource = new VectorSource()
    guessVectorSource.current = vSource
    const vLayer = new VectorLayer({ source: vSource })
    guessLayerRef.current = vLayer

    const gMap = new Map({
      target: guessMapRef.current,
      layers: [gTileLayer, vLayer],
      interactions: defaultInteractions(),
      controls: [],
      view: new View({
        center: fromLonLat(filter === 'indonesia' ? [118, -2.5] : filter === 'europe' ? [15, 50] : [0, 20]),
        zoom: filter === 'indonesia' ? 4 : filter === 'europe' ? 4 : 2,
        minZoom: filter === 'indonesia' ? 4 : filter === 'europe' ? 3 : undefined,
      }),
    })
    guessMapInstance.current = gMap

    gMap.on('click', (e) => {
      const [lng, lat] = toLonLat(e.coordinate)
      setGuessCoord([lng, lat])
    })

    return () => {
      qMap.setTarget(null)
      gMap.setTarget(null)
    }
  }, [roundCities, zoom])

  // Sync zoom slider to question map view (only updates starting zoom, not lock)
  useEffect(() => {
    if (!questionMapInstance.current) return
    const view = questionMapInstance.current.getView()
    view.setMinZoom(MIN_ZOOM)
    view.setZoom(zoom)
  }, [zoom])

  // Update basemap tile URLs when basemap changes
  useEffect(() => {
    const url = BASEMAPS[basemap].url
    if (qTileLayerRef.current) {
      qTileLayerRef.current.setSource(new XYZ({ url }))
    }
    if (gTileLayerRef.current) {
      gTileLayerRef.current.setSource(new XYZ({ url }))
    }
  }, [basemap])

  // Animate question map to new city on round change
  useEffect(() => {
    if (!questionMapInstance.current || !roundCities) return
    const city = roundCities[currentRound]
    questionMapInstance.current.getView().animate({
      center: fromLonLat([city.lng, city.lat]),
      duration: 600,
    })
    // Move city pin to new location
    if (cityPinSource.current) {
      cityPinSource.current.clear()
      const pf = new Feature({ geometry: new Point(fromLonLat([city.lng, city.lat])) })
      pf.setStyle(new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: '#f97316' }),
          stroke: new Stroke({ color: '#fff', width: 2.5 }),
        }),
      }))
      cityPinSource.current.addFeature(pf)
    }
    setGuessCoord(null)
    if (guessVectorSource.current) guessVectorSource.current.clear()
    if (guessMapInstance.current) {
      guessMapInstance.current.getView().animate({
        center: fromLonLat(filter === 'indonesia' ? [118, -2.5] : filter === 'europe' ? [15, 50] : [0, 20]),
        zoom: filter === 'indonesia' ? 4 : filter === 'europe' ? 4 : 2,
        duration: 400,
      })
    }
  }, [currentRound, roundCities])

  // Place/update guess pin when guessCoord changes
  useEffect(() => {
    if (!guessVectorSource.current || !guessCoord) return
    const existing = guessVectorSource.current.getFeatures()
    const hasActual = existing.some((f) => f.get('role') === 'actual')
    if (!hasActual) {
      guessVectorSource.current.clear()
      const f = new Feature({ geometry: new Point(fromLonLat(guessCoord)) })
      f.setStyle(makeGuessPinStyle())
      f.set('role', 'guess')
      guessVectorSource.current.addFeature(f)
    }
  }, [guessCoord])

  // Update map size after phase change
  useEffect(() => {
    setTimeout(() => {
      if (guessMapInstance.current) guessMapInstance.current.updateSize()
      if (questionMapInstance.current) questionMapInstance.current.updateSize()
    }, 50)
  }, [phase])

  // Init explorer map when phase becomes 'explorer'
  useEffect(() => {
    if (phase !== 'explorer') return

    const filteredCities = filterCities(explorerFilter)
    const makeFeatures = (pool) =>
      pool.map((c) => {
        const f = new Feature({ geometry: new Point(fromLonLat([c.lng, c.lat])) })
        f.set('cityData', c)
        return f
      })

    const cityVecSource = new VectorSource({ features: makeFeatures(filteredCities) })
    explorerCityVecSource.current = cityVecSource

    const clusterSource = new Cluster({ distance: 40, source: cityVecSource })
    const clusterLayer = new VectorLayer({
      source: clusterSource,
      style: (feature, resolution) => {
        const count = feature.get('features').length
        if (count === 1) {
          const cityData = feature.get('features')[0].get('cityData')
          // Show label only when zoomed in enough (resolution < 5000 ≈ zoom 5+)
          const showLabel = resolution < 5000
          return new Style({
            image: new CircleStyle({
              radius: 5,
              fill: new Fill({ color: '#3b82f6' }),
              stroke: new Stroke({ color: '#fff', width: 1.5 }),
            }),
            text: showLabel ? new Text({
              text: cityData?.name || '',
              offsetY: -14,
              font: '11px sans-serif',
              fill: new Fill({ color: '#1a1a2e' }),
              stroke: new Stroke({ color: '#fff', width: 3 }),
              overflow: false,
            }) : undefined,
          })
        }
        return new Style({
          image: new CircleStyle({
            radius: 10 + Math.min(count, 20) * 0.5,
            fill: new Fill({ color: '#3b82f6' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
          text: new Text({
            text: String(count),
            fill: new Fill({ color: '#fff' }),
            font: 'bold 11px sans-serif',
          }),
        })
      },
    })

    const tileLayer = new TileLayer({
      source: new XYZ({ url: BASEMAPS.nolabels.url }),
    })

    const map = new Map({
      target: explorerMapRef.current,
      layers: [tileLayer, clusterLayer],
      interactions: defaultInteractions(),
      controls: [],
      view: new View({
        center: fromLonLat([0, 20]),
        zoom: 2,
      }),
    })
    explorerMapInstance.current = map

    // OL Overlay for popup — moves with the map automatically
    const overlay = new Overlay({
      element: explorerPopupRef.current,
      positioning: 'bottom-center',
      offset: [0, -10],
      stopEvent: false,
    })
    map.addOverlay(overlay)
    explorerOverlayRef.current = overlay

    map.on('click', (e) => {
      const features = map.getFeaturesAtPixel(e.pixel)
      if (!features || features.length === 0) {
        overlay.setPosition(undefined)
        setPopup(null)
        return
      }
      const feature = features[0]
      const innerFeatures = feature.get('features')
      if (!innerFeatures) return
      if (innerFeatures.length > 1) {
        overlay.setPosition(undefined)
        setPopup(null)
        const currentZoom = map.getView().getZoom()
        map.getView().animate({
          center: feature.getGeometry().getCoordinates(),
          zoom: currentZoom + 2,
          duration: 400,
        })
      } else {
        const cityData = innerFeatures[0].get('cityData')
        setPopup({ name: cityData.name, country: cityData.country })
        overlay.setPosition(feature.getGeometry().getCoordinates())
      }
    })

    return () => {
      map.setTarget(null)
      explorerMapInstance.current = null
      explorerCityVecSource.current = null
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update explorer city features when filter tab changes
  useEffect(() => {
    if (!explorerCityVecSource.current) return
    const filteredCities = filterCities(explorerFilter)
    const features = filteredCities.map((c) => {
      const f = new Feature({ geometry: new Point(fromLonLat([c.lng, c.lat])) })
      f.set('cityData', c)
      return f
    })
    explorerCityVecSource.current.clear()
    explorerCityVecSource.current.addFeatures(features)
    setPopup(null)
  }, [explorerFilter])

  // Ref so timer callbacks always see latest phase/guessCoord without stale closures
  const onTimerExpireRef = useRef(null)

  // Timer: reset on new round, tick through question + guessing, call onTimerExpireRef at 0
  useEffect(() => {
    if (phase !== 'question' && phase !== 'guessing') return
    if (phase === 'question') setTimeLeft(ROUND_TIME)
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id)
          onTimerExpireRef.current?.()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, currentRound])

  // Always keep expire ref up to date with current phase & guessCoord
  onTimerExpireRef.current = () => {
    if (phase === 'question') {
      setPhase('guessing')
    } else if (phase === 'guessing') {
      // No guess placed → skip round with 0 pts
      if (!guessCoord) {
        setResults((prev) => [
          ...prev,
          { city: roundCities[currentRound].name, country: roundCities[currentRound].country, distKm: 0, score: 0,
            guessLat: null, guessLng: null, actualLat: roundCities[currentRound].lat, actualLng: roundCities[currentRound].lng },
        ])
        const nextRound = currentRound + 1
        if (nextRound >= TOTAL_ROUNDS) setPhase('gameover')
        else { setCurrentRound(nextRound); setPhase('question') }
      } else {
        // Guess placed → auto-confirm
        document.getElementById('mg-confirm-btn')?.click()
      }
    }
  }

  function handleStartGame() {
    clearGameState()
    setSavedState(null)
    mapsInitialized.current = false
    const pool = filterCities(filter)
    const selected = pickCities(TOTAL_ROUNDS, pool)
    setRoundCities(selected)
    setCurrentRound(0)
    setResults([])
    setPhase('question')
  }

  function handleContinueGame() {
    if (!savedState || savedState.filter !== filter) return
    mapsInitialized.current = false
    // Restore to question phase of current incomplete round
    const round = savedState.phase === 'result'
      ? savedState.currentRound + 1
      : savedState.currentRound
    if (round >= TOTAL_ROUNDS) {
      setRoundCities(savedState.roundCities)
      setResults(savedState.results)
      setCurrentRound(TOTAL_ROUNDS - 1)
      setPhase('gameover')
      return
    }
    setRoundCities(savedState.roundCities)
    setResults(savedState.results)
    setCurrentRound(round)
    setPhase('question')
  }

  function handleMakeGuess() {
    setPhase('guessing')
  }

  function handleConfirm() {
    if (!guessCoord) return
    const city = roundCities[currentRound]
    const distKm = haversineKm(guessCoord[1], guessCoord[0], city.lat, city.lng)
    const score = calcScore(distKm, filter)

    const src = guessVectorSource.current
    const actualCoord = fromLonLat([city.lng, city.lat])
    const guessOlCoord = fromLonLat(guessCoord)

    const actualFeature = new Feature({ geometry: new Point(actualCoord) })
    actualFeature.setStyle(makeActualPinStyle())
    actualFeature.set('role', 'actual')
    src.addFeature(actualFeature)

    const lineFeature = new Feature({
      geometry: new LineString([guessOlCoord, actualCoord]),
    })
    lineFeature.setStyle(makeLineStyle())
    lineFeature.set('role', 'line')
    src.addFeature(lineFeature)

    const extent = src.getExtent()
    const view = guessMapInstance.current.getView()
    const mapSize = guessMapInstance.current.getSize()
    view.fit(extent, {
      size: mapSize,
      padding: [80, 80, 80, 80],
      maxZoom: 8,
      duration: 600,
    })

    setResults((prev) => [
      ...prev,
      {
        city: city.name,
        country: city.country,
        distKm: Math.round(distKm),
        score,
        guessLat: guessCoord[1],
        guessLng: guessCoord[0],
        actualLat: city.lat,
        actualLng: city.lng,
      },
    ])
    setPhase('result')
  }

  function handleNext() {
    const nextRound = currentRound + 1
    if (nextRound >= TOTAL_ROUNDS) {
      // Update stats before going to gameover
      const finalScore = results.reduce((sum, r) => sum + r.score, 0)
      const newStats = loadStats()
      const modeStats = newStats[filter]
      modeStats.gamesPlayed += 1
      if (finalScore > modeStats.bestScore) modeStats.bestScore = finalScore
      modeStats.totalScore += finalScore
      saveStats(newStats)
      setStats(newStats)
      clearGameState()
      setSavedState(null)
      setPhase('gameover')
    } else {
      setCurrentRound(nextRound)
      setPhase('question')
    }
  }

  function handlePlayAgain() {
    clearGameState()
    window.location.reload()
  }

  function buildShareText(results, filter, totalScore) {
    const filterLabel = FILTER_LABELS[filter]
    const lines = results.map((r, i) =>
      `Round ${i + 1}: ${r.city} ${scoreToEmojis(r.score)} ${r.score.toLocaleString()} pts`
    )
    return [
      `🗺️ Map Guesser — ${filterLabel}`,
      ...lines,
      `Total: ${totalScore.toLocaleString()} / 25,000`,
      'Play: https://ismailsunni.github.io/games/#/mapguesser',
    ].join('\n')
  }

  async function generateScoreCard(results, filter, totalScore) {
    const SIZE = 1080
    const PAD = 80
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')

    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, SIZE, SIZE)

    const innerW = SIZE - PAD * 2
    let y = PAD

    // Header
    ctx.font = 'bold 40px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#f59e0b'
    ctx.textAlign = 'left'
    ctx.fillText('🌍 OrbIS', PAD, y + 40)
    y += 56

    ctx.font = '28px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('Map Guesser', PAD, y + 28)
    y += 42

    ctx.font = '20px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#6366f1'
    ctx.fillText(FILTER_LABELS[filter] || 'All Cities', PAD, y + 20)
    y += 38

    // Divider
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(PAD + innerW, y)
    ctx.stroke()
    y += 24

    // Rounds list (5 rows ~80px each)
    const ROW_H = 80
    for (const r of results) {
      // City + country
      ctx.font = '22px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(`${r.city}, ${r.country}`, PAD, y + 22)

      // Score pts right-aligned
      ctx.font = '20px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#f59e0b'
      ctx.textAlign = 'right'
      ctx.fillText(`${r.score.toLocaleString()} pts`, PAD + innerW, y + 22)

      // Score bar
      const BAR_TOP = y + 34
      const BAR_H = 12
      const BAR_W = innerW
      const filled = BAR_W * (r.score / 5000)
      const radius = BAR_H / 2

      // Background bar
      ctx.fillStyle = '#2a2a4e'
      ctx.beginPath()
      ctx.roundRect(PAD, BAR_TOP, BAR_W, BAR_H, radius)
      ctx.fill()

      // Filled bar
      if (filled > 0) {
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.roundRect(PAD, BAR_TOP, Math.max(filled, BAR_H), BAR_H, radius)
        ctx.fill()
      }

      y += ROW_H
    }

    y += 8

    // Total score block
    ctx.textAlign = 'left'
    ctx.font = '20px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#6666aa'
    ctx.fillText('Total', PAD, y + 20)
    y += 36

    ctx.font = 'bold 44px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${totalScore.toLocaleString()} / 25,000`, PAD, y + 44)
    y += 62

    const trophy = totalScore >= 20000 ? '🏆' : totalScore >= 12500 ? '🥈' : '🌍'
    ctx.font = '48px system-ui, -apple-system, sans-serif'
    ctx.fillText(trophy, PAD, y + 48)
    y += 70

    // Footer
    ctx.font = '18px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#6666aa'
    ctx.textAlign = 'center'
    ctx.fillText('Play at ismailsunni.github.io/games', SIZE / 2, SIZE - PAD + 18)

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  }

  async function handleShare() {
    setShareStatus('generating')

    const blob = await generateScoreCard(results, filter, totalScore)
    const file = new File([blob], 'orbis-mapguesser.png', { type: 'image/png' })

    // Mobile: try file share first (shows Instagram in share sheet)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'OrbIS Map Guesser',
          text: `I scored ${totalScore.toLocaleString()} / 25,000 on Map Guesser! Play at https://ismailsunni.github.io/games/#/mapguesser`,
        })
        setShareStatus(null)
        return
      } catch (e) {
        if (e.name !== 'AbortError') {
          // fall through to text share
        } else {
          setShareStatus(null)
          return
        }
      }
    }

    // Fallback: text share
    if (navigator.share) {
      try {
        await navigator.share({ text: buildShareText(results, filter, totalScore) })
        setShareStatus(null)
        return
      } catch {}
    }

    // Desktop fallback: download image + copy text
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'orbis-mapguesser.png'
    a.click()
    URL.revokeObjectURL(url)
    navigator.clipboard.writeText(buildShareText(results, filter, totalScore)).catch(() => {})
    setShareStatus('downloaded')
    setTimeout(() => setShareStatus(null), 3000)
  }

  const totalScore = results.reduce((sum, r) => sum + r.score, 0)
  const city = roundCities ? roundCities[currentRound] : null
  const currentResult = results[results.length - 1]

  const isQuestion = phase === 'question'
  const isGuessing = phase === 'guessing'
  const isResult = phase === 'result'
  const isGameover = phase === 'gameover'
  const isLobby = phase === 'lobby'
  const isExplorer = phase === 'explorer'

  // ── Lobby screen ──────────────────────────────────────────────────────────
  if (isLobby) {
    const filterOptions = [
      { value: 'all', label: 'All cities', desc: `${cities.length} cities worldwide` },
      { value: 'capitals', label: 'Capital cities only', desc: `${cities.filter(c => c.capital).length} world capitals` },
      { value: 'europe', label: 'Europe only', desc: `${cities.filter(c => c.continent === 'Europe').length} European cities` },
      { value: 'indonesia', label: 'Indonesia only', desc: `${cities.filter(c => c.indonesia).length} cities & kabupatens` },
    ]
    const hasContinue = savedState && savedState.filter === filter

    return (
      <div className="min-h-screen bg-paper font-body flex flex-col">
        <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
          <a href="#/" className="text-accent hover:underline text-sm font-medium">← Back</a>
          <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">🗺️ Map Guesser</h1>
          <div className="w-12" />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 max-w-md mx-auto w-full gap-8">
          <div className="text-center">
            <p className="text-ink/60 text-sm">Guess the location of 5 cities — 30 seconds per round</p>
          </div>

          <div className="w-full bg-white border border-ink/10 rounded-xl p-5">
            <div className="text-sm font-semibold text-ink mb-3">City set</div>
            <div className="flex flex-col gap-2">
              {filterOptions.map((opt) => {
                const modeStats = stats[opt.value]
                return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                      filter === opt.value
                        ? 'border-accent bg-accent/5'
                        : 'border-ink/10 hover:border-accent/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="filter"
                      value={opt.value}
                      checked={filter === opt.value}
                      onChange={() => setFilter(opt.value)}
                      className="mt-0.5 accent-accent"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink">{opt.label}</div>
                      <div className="text-xs text-ink/50">{opt.desc}</div>
                      {modeStats.gamesPlayed > 0 && (
                        <div className="text-xs text-ink/40 mt-0.5">
                          {modeStats.gamesPlayed} {modeStats.gamesPlayed === 1 ? 'game' : 'games'} · best {modeStats.bestScore.toLocaleString()} pts
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="w-full flex flex-col gap-3">
            {hasContinue && (
              <button
                onClick={handleContinueGame}
                className="w-full border border-accent text-accent font-semibold py-3 px-6 rounded-lg hover:bg-accent/5 transition-colors text-base"
              >
                Continue game (Round {savedState.currentRound + 1})
              </button>
            )}
            <button
              onClick={handleStartGame}
              className="w-full bg-accent text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity text-base"
            >
              {hasContinue ? 'New Game' : 'Start Game →'}
            </button>
            <button
              onClick={() => setPhase('explorer')}
              className="w-full border border-ink/20 text-ink font-medium py-3 px-6 rounded-lg hover:border-accent hover:text-accent transition-colors text-base"
            >
              🌍 Browse cities
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Explorer screen ────────────────────────────────────────────────────────
  if (isExplorer) {
    const explorerTabs = [
      { value: 'all', label: 'All' },
      { value: 'capitals', label: 'Capitals' },
      { value: 'europe', label: 'Europe' },
      { value: 'indonesia', label: 'Indonesia' },
    ]
    return (
      <div className="fixed inset-0 flex flex-col bg-paper font-body overflow-hidden">
        <header className="flex-none border-b border-ink/10 bg-canvas px-4 py-2 flex items-center gap-3 z-10">
          <button
            onClick={() => { setPhase('lobby'); setPopup(null); if (explorerOverlayRef.current) explorerOverlayRef.current.setPosition(undefined) }}
            className="text-accent hover:underline text-sm font-medium"
          >
            ← Back
          </button>
          <h1 className="font-display text-lg font-bold text-ink flex-1 text-center">🌍 Cities Explorer</h1>
          <div className="w-12" />
        </header>

        <div className="flex-1 relative overflow-hidden">
          <div ref={explorerMapRef} className="w-full h-full" />

          {/* Filter tabs */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex gap-1 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-2 py-1.5">
            {explorerTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setExplorerFilter(tab.value)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  explorerFilter === tab.value
                    ? 'bg-accent text-white'
                    : 'text-ink/70 hover:bg-ink/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* City popup — OL Overlay, moves with map */}
          <div
            ref={explorerPopupRef}
            className={`z-40 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 pointer-events-none transition-opacity ${popup ? 'opacity-100' : 'opacity-0'}`}
          >
            {popup && (
              <>
                <div className="text-sm font-semibold text-ink">{popup.name}</div>
                <div className="text-xs text-ink/60">{popup.country}</div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Game over screen ──────────────────────────────────────────────────────
  if (isGameover) {
    return (
      <div className="min-h-screen bg-paper font-body flex flex-col">
        <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
          <a href="#/" className="text-accent hover:underline text-sm font-medium">← Back</a>
          <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">🗺️ Map Guesser</h1>
          <div className="text-sm text-ink/60 w-20 text-right">Final</div>
        </header>

        <div className="flex-1 overflow-auto px-4 py-6 max-w-2xl mx-auto w-full">
          <div className="text-center mb-6">
            <div className="font-display text-4xl font-bold text-ink">{totalScore.toLocaleString()}</div>
            <div className="text-ink/60 text-sm mt-1">out of 25,000 points</div>
            <div className="mt-2 text-2xl">
              {totalScore >= 20000 ? '🏆' : totalScore >= 12500 ? '🥈' : '🌍'}
            </div>
            {/* Total score bar */}
            <div className="mt-3 mx-auto max-w-xs">
              <div className="w-full bg-ink/10 rounded-full h-2">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${(totalScore / 25000) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Per-round summary with bars */}
          <div className="bg-white border border-ink/10 rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-2 bg-canvas border-b border-ink/10">
              <span className="text-xs font-semibold text-ink/60 uppercase tracking-wide">Results</span>
            </div>
            <div className="divide-y divide-ink/5">
              {results.map((r, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-sm font-medium text-ink">{r.city}</span>
                      <span className="text-xs text-ink/50 ml-1">{r.country}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-accent">{r.score.toLocaleString()}</span>
                      <span className="text-xs text-ink/40 ml-1">/ 5,000</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-ink/10 rounded-full h-1.5">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${(r.score / 5000) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink/40 whitespace-nowrap">{r.distKm.toLocaleString()} km</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Share buttons */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => {
                const text = buildShareText(results, filter, totalScore)
                const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
                window.open(url, '_blank')
              }}
              className="flex-1 border border-ink/20 text-ink font-medium py-3 px-3 rounded-lg hover:border-[#1da1f2] hover:text-[#1da1f2] transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              𝕏 Twitter
            </button>
            <button
              onClick={() => {
                const text = buildShareText(results, filter, totalScore)
                const url = `https://wa.me/?text=${encodeURIComponent(text)}`
                window.open(url, '_blank')
              }}
              className="flex-1 border border-ink/20 text-ink font-medium py-3 px-3 rounded-lg hover:border-[#25d366] hover:text-[#25d366] transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              💬 WhatsApp
            </button>
            <button
              onClick={handleShare}
              disabled={shareStatus === 'generating'}
              className="flex-1 border border-ink/20 text-ink font-medium py-3 px-3 rounded-lg hover:border-[#e1306c] hover:text-[#e1306c] transition-colors flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
            >
              {shareStatus === 'generating' ? '⏳' :
               shareStatus === 'downloaded' ? '✓ Saved' :
               '📸 Instagram'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePlayAgain}
              className="flex-1 bg-accent text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity"
            >
              Play again
            </button>
            <a
              href="#/"
              className="flex-1 text-center border border-ink/20 text-ink font-medium py-3 px-6 rounded-lg hover:border-accent hover:text-accent transition-colors"
            >
              ← Back to games
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Main game screen ──────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-paper font-body overflow-hidden">
      {/* Header */}
      <header className="flex-none border-b border-ink/10 bg-canvas px-4 py-2 flex items-center gap-3 z-10">
        <a href="#/" className="text-accent hover:underline text-sm font-medium whitespace-nowrap">← Back</a>
        <h1 className="font-display text-lg font-bold text-ink flex-1 text-center">🗺️ Map Guesser</h1>
        <div className="text-sm text-ink/60 whitespace-nowrap w-28 text-right">
          Round {currentRound + 1}/5 · {totalScore.toLocaleString()} pts
        </div>
      </header>

      {/* Progress dots */}
      <div className="flex-none flex justify-center gap-2 py-2 bg-canvas border-b border-ink/5">
        {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < currentRound
                ? 'bg-ink/40'
                : i === currentRound
                ? 'bg-accent'
                : 'bg-ink/10'
            }`}
          />
        ))}
      </div>

      {/* Timer bar — runs through question + guessing */}
      {(isQuestion || isGuessing) && (
        <div className="flex-none h-1 bg-ink/10">
          <div
            className="h-full bg-accent transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / ROUND_TIME) * 100}%` }}
          />
        </div>
      )}

      {/* Map area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Top-right controls: basemap dropdown + zoom slider */}
        <div className="absolute top-3 right-3 z-30 flex flex-col gap-2 items-end">
          <select
            value={basemap}
            onChange={(e) => setBasemap(e.target.value)}
            className="text-xs px-2 py-1.5 rounded shadow font-medium bg-white/90 text-ink border-0 cursor-pointer"
          >
            {Object.entries(BASEMAPS).map(([key, bm]) => (
              <option key={key} value={key}>{bm.label}</option>
            ))}
          </select>

        </div>

        {/* Timer countdown badge */}
        {(isQuestion || isGuessing) && (
          <div
            className={`absolute top-3 left-3 z-30 px-2.5 py-1 rounded-lg text-sm font-bold shadow bg-white/90 tabular-nums transition-colors ${
              timeLeft <= 10 ? 'text-red-500' : 'text-ink'
            }`}
          >
            {timeLeft}s
          </div>
        )}

        {/* Question map */}
        <div
          className="absolute inset-0"
          style={{
            visibility: isQuestion ? 'visible' : 'hidden',
            pointerEvents: isQuestion ? 'auto' : 'none',
          }}
        >
          <div ref={questionMapRef} className="w-full h-full" />
        </div>

        {/* Guess map */}
        <div
          className="absolute inset-0"
          style={{
            visibility: isQuestion ? 'hidden' : 'visible',
            pointerEvents: isQuestion ? 'none' : 'auto',
          }}
        >
          <div ref={guessMapRef} className={`w-full h-full ${isGuessing ? 'cursor-crosshair' : ''}`} />
        </div>

        {/* Floating: question CTA */}
        {isQuestion && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 whitespace-nowrap">
            <button
              onClick={() => {
                if (!questionMapInstance.current || !city) return
                questionMapInstance.current.getView().animate({
                  center: fromLonLat([city.lng, city.lat]),
                  zoom: zoom,
                  rotation: 0,
                  duration: 400,
                })
              }}
              className="text-ink/60 hover:text-accent px-2 py-1.5 rounded-lg hover:bg-ink/5 transition-colors text-base leading-none"
              title="Re-centre to city"
            >
              ◎
            </button>
            <div className="w-px h-5 bg-ink/15" />
            <button
              onClick={handleMakeGuess}
              className="bg-accent text-white font-semibold px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Guess →
            </button>
          </div>
        )}

        {/* Floating: confirm guess */}
        {isGuessing && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 whitespace-nowrap">
            <button
              onClick={() => setPhase('question')}
              className="text-ink/60 hover:text-accent px-2 py-1.5 rounded-lg hover:bg-ink/5 transition-colors text-sm font-medium"
              title="Back to question map"
            >
              ← Map
            </button>
            <div className="w-px h-5 bg-ink/15" />
            <span className="text-sm text-ink/70">
              {guessCoord ? '📍 Move' : '📍 Place'}
            </span>
            <button
              id="mg-confirm-btn"
              onClick={handleConfirm}
              disabled={!guessCoord}
              className="bg-accent text-white font-semibold px-4 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity text-sm"
            >
              Confirm ✓
            </button>
          </div>
        )}

        {/* Floating: result + next */}
        {isResult && currentResult && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 max-w-sm w-full">
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0">
                <div className="font-semibold text-ink text-sm truncate">
                  {currentResult.city}, {currentResult.country}
                </div>
                <div className="text-xs text-ink/60">
                  {currentResult.distKm.toLocaleString()} km away
                </div>
              </div>
              <div className="text-right ml-3 shrink-0">
                <div className="font-bold text-accent text-base">+{currentResult.score.toLocaleString()}</div>
                <div className="text-xs text-ink/40">/ 5,000</div>
              </div>
            </div>
            {/* Score bar */}
            <div className="w-full bg-ink/10 rounded-full h-1.5 mb-3">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${(currentResult.score / 5000) * 100}%` }}
              />
            </div>
            <button
              onClick={handleNext}
              className="w-full bg-accent text-white font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              {currentRound + 1 >= TOTAL_ROUNDS ? 'Results →' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
