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
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style'
import { defaults as defaultInteractions } from 'ol/interaction'
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

function calcScore(distKm, isIndonesia = false) {
  // Indonesia: max meaningful distance ~2000km (Sabang–Merauke ~5200km, but granularity matters more)
  const maxDist = isIndonesia ? 2000 : 10000
  return Math.max(0, Math.round(5000 * (1 - distKm / maxDist)))
}

function filterCities(filter) {
  if (filter === 'capitals') return cities.filter((c) => c.capital)
  if (filter === 'indonesia') return cities.filter((c) => c.indonesia)
  return cities
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
  const questionMapInstance = useRef(null)
  const guessMapInstance = useRef(null)
  const qTileLayerRef = useRef(null)
  const gTileLayerRef = useRef(null)
  const guessVectorSource = useRef(null)
  const guessLayerRef = useRef(null)
  const cityPinSource = useRef(null)
  const mapsInitialized = useRef(false)

  const [basemap, setBasemap] = useState('nolabels')
  const [zoom] = useState(15)
  const MIN_ZOOM = 10
  const [filter, setFilter] = useState('all')
  const [phase, setPhase] = useState('lobby') // lobby | question | guessing | result | gameover
  const [roundCities, setRoundCities] = useState(null)
  const [currentRound, setCurrentRound] = useState(0)
  const [guessCoord, setGuessCoord] = useState(null) // [lng, lat]
  const [results, setResults] = useState([])
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)

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
    const city = roundCities[0]
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

    const indonesiaMode = filter === 'indonesia'
    const gMap = new Map({
      target: guessMapRef.current,
      layers: [gTileLayer, vLayer],
      interactions: defaultInteractions(),
      controls: [],
      view: new View({
        center: fromLonLat(indonesiaMode ? [118, -2.5] : [0, 20]),
        zoom: indonesiaMode ? 4 : 2,
        minZoom: indonesiaMode ? 4 : undefined,
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
      const indonesiaMode = filter === 'indonesia'
      guessMapInstance.current.getView().animate({
        center: fromLonLat(indonesiaMode ? [118, -2.5] : [0, 20]),
        zoom: indonesiaMode ? 4 : 2,
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

  // Timer for question phase
  useEffect(() => {
    if (phase !== 'question') return
    setTimeLeft(ROUND_TIME)
    let id
    id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id)
          setPhase('guessing')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, currentRound])

  function handleStartGame() {
    const pool = filterCities(filter)
    const selected = pickCities(TOTAL_ROUNDS, pool)
    setRoundCities(selected)
    setPhase('question')
  }

  function handleMakeGuess() {
    setPhase('guessing')
  }

  function handleConfirm() {
    if (!guessCoord) return
    const city = roundCities[currentRound]
    const distKm = haversineKm(guessCoord[1], guessCoord[0], city.lat, city.lng)
    const score = calcScore(distKm, filter === 'indonesia')

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
      setPhase('gameover')
    } else {
      setCurrentRound(nextRound)
      setPhase('question')
    }
  }

  function handlePlayAgain() {
    window.location.reload()
  }

  const totalScore = results.reduce((sum, r) => sum + r.score, 0)
  const city = roundCities ? roundCities[currentRound] : null
  const currentResult = results[results.length - 1]

  const isQuestion = phase === 'question'
  const isGuessing = phase === 'guessing'
  const isResult = phase === 'result'
  const isGameover = phase === 'gameover'
  const isLobby = phase === 'lobby'

  // ── Lobby screen ──────────────────────────────────────────────────────────
  if (isLobby) {
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
              {[
                { value: 'all', label: 'All cities', desc: `${cities.length} cities worldwide` },
                { value: 'capitals', label: 'Capital cities only', desc: `${cities.filter(c => c.capital).length} world capitals` },
                { value: 'indonesia', label: 'Indonesia only', desc: `${cities.filter(c => c.indonesia).length} cities & kabupatens` },
              ].map((opt) => (
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
                  <div>
                    <div className="text-sm font-medium text-ink">{opt.label}</div>
                    <div className="text-xs text-ink/50">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartGame}
            className="w-full bg-accent text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity text-base"
          >
            Start Game →
          </button>
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

      {/* Timer bar — only during question phase */}
      {isQuestion && (
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
        {isQuestion && (
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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3">
            <button
              onClick={handleMakeGuess}
              className="bg-accent text-white font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Guess the city →
            </button>
          </div>
        )}

        {/* Floating: confirm guess */}
        {isGuessing && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 whitespace-nowrap">
            <span className="text-sm text-ink/70">
              {guessCoord ? '📍 Click to move' : '📍 Click to place'}
            </span>
            <button
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
