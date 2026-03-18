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
import { getWidth, getHeight } from 'ol/extent'
import cities from '../data/cities'

const TOTAL_ROUNDS = 5

const BASEMAPS = {
  nolabels: {
    label: 'Streets (no labels)',
    url: 'https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
  },
  toner: {
    label: 'Toner (no labels)',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}.png',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
  street: {
    label: 'Street (with labels)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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

function calcScore(distKm) {
  return Math.max(0, Math.round(5000 * (1 - distKm / 10000)))
}

function pickCities(count) {
  const shuffled = [...cities].sort(() => Math.random() - 0.5)
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

  const [basemap, setBasemap] = useState('nolabels')
  const [phase, setPhase] = useState('question') // question | guessing | result | gameover
  const [roundCities] = useState(() => pickCities(TOTAL_ROUNDS))
  const [currentRound, setCurrentRound] = useState(0)
  const [guessCoord, setGuessCoord] = useState(null) // [lng, lat]
  const [results, setResults] = useState([])

  // Init both maps once
  useEffect(() => {
    const qTileLayer = new TileLayer({
      source: new XYZ({ url: BASEMAPS.nolabels.url }),
    })
    qTileLayerRef.current = qTileLayer

    const city = roundCities[0]
    const qMap = new Map({
      target: questionMapRef.current,
      layers: [qTileLayer],
      interactions: [],
      controls: [],
      view: new View({
        center: fromLonLat([city.lng, city.lat]),
        zoom: 19,
        minZoom: 19,
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
        center: fromLonLat([0, 20]),
        zoom: 2,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (!questionMapInstance.current) return
    const city = roundCities[currentRound]
    questionMapInstance.current.getView().animate({
      center: fromLonLat([city.lng, city.lat]),
      duration: 600,
    })
    // Reset guess state
    setGuessCoord(null)
    if (guessVectorSource.current) guessVectorSource.current.clear()
    // Reset guess map view
    if (guessMapInstance.current) {
      guessMapInstance.current.getView().animate({
        center: fromLonLat([0, 20]),
        zoom: 2,
        duration: 400,
      })
    }
  }, [currentRound, roundCities])

  // Place/update guess pin when guessCoord changes
  useEffect(() => {
    if (!guessVectorSource.current || !guessCoord) return
    // Only manage guess pin here (actual pin + line added on confirm)
    // We keep guess pin as the first feature; clear all and re-add only guess
    const existing = guessVectorSource.current.getFeatures()
    const hasActual = existing.some((f) => f.get('role') === 'actual')
    if (!hasActual) {
      guessVectorSource.current.clear()
      const f = new Feature({ geometry: new Point(fromLonLat(guessCoord)) })
      f.setStyle(makeGuessPinStyle())
      f.set('role', 'guess')
      guessVectorSource.current.addFeature(f)
    } else {
      // During result phase, don't move existing pins
    }
  }, [guessCoord])

  // Update guess map size after phase change
  useEffect(() => {
    setTimeout(() => {
      if (guessMapInstance.current) guessMapInstance.current.updateSize()
      if (questionMapInstance.current) questionMapInstance.current.updateSize()
    }, 50)
  }, [phase])

  function handleMakeGuess() {
    setPhase('guessing')
  }

  function handleConfirm() {
    if (!guessCoord) return
    const city = roundCities[currentRound]
    const distKm = haversineKm(guessCoord[1], guessCoord[0], city.lat, city.lng)
    const score = calcScore(distKm)

    // Add actual pin and line
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

    // Fit view to show both pins
    const extent = src.getExtent()
    const view = guessMapInstance.current.getView()
    const mapSize = guessMapInstance.current.getSize()
    // Add padding so pins aren't at the edge
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
  const city = roundCities[currentRound]
  const currentResult = results[results.length - 1]

  const isQuestion = phase === 'question'
  const isGuessing = phase === 'guessing'
  const isResult = phase === 'result'
  const isGameover = phase === 'gameover'

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
          </div>

          <div className="bg-white border border-ink/10 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-canvas border-b border-ink/10">
                <tr>
                  <th className="text-left px-4 py-2 text-ink/60 font-medium">City</th>
                  <th className="text-left px-4 py-2 text-ink/60 font-medium hidden sm:table-cell">Country</th>
                  <th className="text-right px-4 py-2 text-ink/60 font-medium">Distance</th>
                  <th className="text-right px-4 py-2 text-ink/60 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3 text-ink font-medium">{r.city}</td>
                    <td className="px-4 py-3 text-ink/60 hidden sm:table-cell">{r.country}</td>
                    <td className="px-4 py-3 text-ink/60 text-right">{r.distKm.toLocaleString()} km</td>
                    <td className="px-4 py-3 text-accent font-semibold text-right">{r.score.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-canvas border-t border-ink/10">
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-display font-bold text-ink">Total</td>
                  <td className="px-4 py-3 hidden sm:table-cell"></td>
                  <td className="px-4 py-3 text-accent font-bold text-right text-base">{totalScore.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
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

      {/* Map area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Basemap switcher */}
        <div className="absolute top-3 right-3 z-30 flex flex-col gap-1">
          {Object.entries(BASEMAPS).map(([key, bm]) => (
            <button
              key={key}
              onClick={() => setBasemap(key)}
              className={`text-xs px-2 py-1 rounded shadow font-medium transition-colors ${
                basemap === key
                  ? 'bg-accent text-white'
                  : 'bg-white/90 text-ink hover:bg-white'
              }`}
            >
              {bm.label}
            </button>
          ))}
        </div>

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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3">
            <span className="text-sm text-ink/70">Where is this city?</span>
            <button
              onClick={handleMakeGuess}
              className="bg-accent text-white font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Make your guess →
            </button>
          </div>
        )}

        {/* Floating: confirm guess */}
        {isGuessing && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3">
            <span className="text-sm text-ink/70">
              {guessCoord ? 'Pin placed — click to move' : 'Click the map to place your guess'}
            </span>
            <button
              onClick={handleConfirm}
              disabled={!guessCoord}
              className="bg-accent text-white font-semibold px-5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity text-sm"
            >
              Confirm ✓
            </button>
          </div>
        )}

        {/* Floating: result + next */}
        {isResult && currentResult && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 max-w-sm w-full">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink text-sm truncate">
                {currentResult.city}, {currentResult.country}
              </div>
              <div className="text-xs text-ink/60">
                {currentResult.distKm.toLocaleString()} km away · +{currentResult.score.toLocaleString()} pts
              </div>
            </div>
            <button
              onClick={handleNext}
              className="bg-accent text-white font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm whitespace-nowrap"
            >
              {currentRound + 1 >= TOTAL_ROUNDS ? 'Results →' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
