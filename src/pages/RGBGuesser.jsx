import { useEffect, useRef, useState } from 'react'
import { colors } from '../data/colors'

const TOTAL_ROUNDS = 5
const ROUND_TIME = 30

function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function calcDistance(r1, g1, b1, r2, g2, b2) {
  return Math.round(Math.sqrt((r2 - r1) ** 2 + (g2 - g1) ** 2 + (b2 - b1) ** 2))
}

function getRating(total) {
  if (total === 0) return { label: 'Perfect!', emoji: '🏆' }
  if (total <= 50) return { label: 'Excellent', emoji: '🥇' }
  if (total <= 150) return { label: 'Good', emoji: '🥈' }
  if (total <= 300) return { label: 'OK', emoji: '🥉' }
  return { label: 'Keep practicing', emoji: '🎨' }
}

function loadStats() {
  try {
    const s = localStorage.getItem('colorguesser_rgb_stats')
    return s ? { gamesPlayed: 0, bestTotal: null, totalDistance: 0, ...JSON.parse(s) } : { gamesPlayed: 0, bestTotal: null, totalDistance: 0 }
  } catch {
    return { gamesPlayed: 0, bestTotal: null, totalDistance: 0 }
  }
}

function saveStats(stats) {
  localStorage.setItem('colorguesser_rgb_stats', JSON.stringify(stats))
}

function pickColors(count) {
  const shuffled = [...colors].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export default function RGBGuesser() {
  const [phase, setPhase] = useState('playing') // playing | result | gameover
  const [roundColors, setRoundColors] = useState(() => pickColors(TOTAL_ROUNDS))
  const [currentRound, setCurrentRound] = useState(0)
  const [guessR, setGuessR] = useState(128)
  const [guessG, setGuessG] = useState(128)
  const [guessB, setGuessB] = useState(128)
  const [results, setResults] = useState([])
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)

  const onTimerExpireRef = useRef(null)

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return
    setTimeLeft(ROUND_TIME)
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
  }, [phase, currentRound]) // eslint-disable-line react-hooks/exhaustive-deps

  onTimerExpireRef.current = () => {
    handleConfirm()
  }

  function handleConfirm() {
    const color = roundColors[currentRound]
    const dist = calcDistance(guessR, guessG, guessB, color.r, color.g, color.b)
    setResults((prev) => [...prev, { color, guessR, guessG, guessB, dist }])
    setPhase('result')
  }

  function handleNext() {
    const nextRound = currentRound + 1
    if (nextRound >= TOTAL_ROUNDS) {
      setPhase('gameover')
    } else {
      setCurrentRound(nextRound)
      setGuessR(128)
      setGuessG(128)
      setGuessB(128)
      setPhase('playing')
    }
  }

  function handlePlayAgain() {
    setRoundColors(pickColors(TOTAL_ROUNDS))
    setCurrentRound(0)
    setResults([])
    setGuessR(128)
    setGuessG(128)
    setGuessB(128)
    setPhase('playing')
  }

  // Save stats when gameover reached
  useEffect(() => {
    if (phase !== 'gameover') return
    const totalDist = results.reduce((s, r) => s + r.dist, 0)
    const prev = loadStats()
    const next = {
      gamesPlayed: prev.gamesPlayed + 1,
      bestTotal: prev.bestTotal === null ? totalDist : Math.min(prev.bestTotal, totalDist),
      totalDistance: prev.totalDistance + totalDist,
    }
    saveStats(next)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const color = roundColors[currentRound]
  const totalDist = results.reduce((s, r) => s + r.dist, 0)

  // ── Game Over ─────────────────────────────────────────────────────────────
  if (phase === 'gameover') {
    const rating = getRating(totalDist)
    const maxPossible = Math.round(Math.sqrt(3) * 255) * TOTAL_ROUNDS
    return (
      <div className="min-h-screen bg-paper font-body flex flex-col">
        <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
          <a href="#/colorguesser" className="text-accent hover:underline text-sm font-medium">← Back</a>
          <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">🌈 RGB Guesser</h1>
          <div className="text-sm text-ink/60 w-16 text-right">Final</div>
        </header>

        <div className="flex-1 overflow-auto px-4 py-6 max-w-xl mx-auto w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-1">{rating.emoji}</div>
            <div className="font-display text-3xl font-bold text-ink">{totalDist}</div>
            <div className="text-ink/60 text-sm mt-1">total distance · {rating.label}</div>
            <div className="mt-3 mx-auto max-w-xs">
              <div className="w-full bg-ink/10 rounded-full h-2">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${Math.max(4, 100 - (totalDist / maxPossible) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-ink/40 mt-1">
                <span>0 = perfect</span>
                <span>{maxPossible} = worst</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-ink/10 rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-2 bg-canvas border-b border-ink/10">
              <span className="text-xs font-semibold text-ink/60 uppercase tracking-wide">Per round</span>
            </div>
            <div className="divide-y divide-ink/5">
              {results.map((r, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex-none border border-ink/10"
                    style={{ background: toHex(r.color.r, r.color.g, r.color.b) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{r.color.name}</div>
                    <div className="text-xs text-ink/50">
                      Actual {toHex(r.color.r, r.color.g, r.color.b).toUpperCase()} · Guess {toHex(r.guessR, r.guessG, r.guessB).toUpperCase()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${r.dist === 0 ? 'text-green-600' : r.dist <= 30 ? 'text-accent' : 'text-ink'}`}>
                      {r.dist}
                    </div>
                    <div className="text-xs text-ink/40">dist</div>
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
              href="#/colorguesser"
              className="flex-1 text-center border border-ink/20 text-ink font-medium py-3 px-6 rounded-lg hover:border-accent hover:text-accent transition-colors"
            >
              ← Modes
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Playing / Result ──────────────────────────────────────────────────────
  const currentResult = results[results.length - 1]
  const guessHex = toHex(guessR, guessG, guessB)
  const actualHex = toHex(color.r, color.g, color.b)

  return (
    <div className="min-h-screen bg-paper font-body flex flex-col">
      <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
        <a href="#/colorguesser" className="text-accent hover:underline text-sm font-medium">← Back</a>
        <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">🌈 RGB Guesser</h1>
        <div className="text-sm text-ink/60 whitespace-nowrap">
          {currentRound + 1}/{TOTAL_ROUNDS}
        </div>
      </header>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 py-2 bg-canvas border-b border-ink/5">
        {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < currentRound ? 'bg-ink/40' : i === currentRound ? 'bg-accent' : 'bg-ink/10'
            }`}
          />
        ))}
      </div>

      {/* Timer bar */}
      {phase === 'playing' && (
        <div className="h-1 bg-ink/10">
          <div
            className="h-full bg-accent transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / ROUND_TIME) * 100}%` }}
          />
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 py-6 max-w-xl mx-auto w-full flex flex-col gap-6">
        {/* Color swatches row */}
        <div className="flex gap-3">
          {/* Target swatch */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="text-xs text-ink/50 text-center font-medium">Target color</div>
            <div
              className="w-full rounded-xl border border-ink/10"
              style={{ background: actualHex, aspectRatio: '1' }}
            />
            {phase === 'result' && (
              <div className="text-center text-xs text-ink/60 mt-1">
                <div className="font-semibold text-ink">{color.name}</div>
                <div>{actualHex.toUpperCase()}</div>
                <div className="text-ink/50">rgb({color.r}, {color.g}, {color.b})</div>
              </div>
            )}
          </div>

          {/* Guess swatch */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="text-xs text-ink/50 text-center font-medium">Your guess</div>
            <div
              className="w-full rounded-xl border border-ink/10"
              style={{ background: guessHex, aspectRatio: '1' }}
            />
            {phase === 'result' && (
              <div className="text-center text-xs text-ink/60 mt-1">
                <div className="font-semibold text-ink">Your guess</div>
                <div>{guessHex.toUpperCase()}</div>
                <div className="text-ink/50">rgb({guessR}, {guessG}, {guessB})</div>
              </div>
            )}
          </div>
        </div>

        {phase === 'playing' && (
          <>
            {/* Timer badge */}
            <div className="flex justify-between items-center">
              <div className={`px-3 py-1 rounded-lg text-sm font-bold bg-white border border-ink/10 tabular-nums ${timeLeft <= 10 ? 'text-red-500' : 'text-ink'}`}>
                {timeLeft}s
              </div>
              <div className="text-sm text-ink/50">Total so far: {totalDist}</div>
            </div>

            {/* Sliders */}
            <div className="bg-white border border-ink/10 rounded-xl p-5 flex flex-col gap-5">
              {[
                { label: 'R', value: guessR, setter: setGuessR, color: 'bg-red-500' },
                { label: 'G', value: guessG, setter: setGuessG, color: 'bg-green-500' },
                { label: 'B', value: guessB, setter: setGuessB, color: 'bg-blue-500' },
              ].map(({ label, value, setter, color: barColor }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full ${barColor} flex-none`} />
                  <input
                    type="range"
                    min={0}
                    max={255}
                    step={1}
                    value={value}
                    onChange={(e) => setter(Number(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={value}
                    onChange={(e) => setter(Math.min(255, Math.max(0, Number(e.target.value))))}
                    className="w-14 text-center text-sm font-mono border border-ink/20 rounded-md py-1 bg-paper text-ink focus:outline-none focus:border-accent"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleConfirm}
              className="w-full bg-accent text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Confirm →
            </button>
          </>
        )}

        {phase === 'result' && currentResult && (
          <div className="bg-white border border-ink/10 rounded-xl p-5 flex flex-col gap-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${currentResult.dist === 0 ? 'text-green-600' : 'text-ink'}`}>
                {currentResult.dist === 0 ? '🎯 Perfect!' : `Distance: ${currentResult.dist}`}
              </div>
              <div className="text-sm text-ink/60 mt-1">Total distance: {totalDist}</div>
            </div>
            <button
              onClick={handleNext}
              className="w-full bg-accent text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              {currentRound + 1 >= TOTAL_ROUNDS ? 'See results →' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
