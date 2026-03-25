import { useEffect, useRef, useState } from 'react'
import { colors } from '../data/colors'

const TOTAL_ROUNDS = 5
const ROUND_TIME = 30
const POINTS_PER_ROUND = 5000

function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function getRating(score) {
  const pct = score / (TOTAL_ROUNDS * POINTS_PER_ROUND)
  if (pct === 1) return { label: 'Perfect!', emoji: '🏆' }
  if (pct >= 0.8) return { label: 'Excellent', emoji: '🥇' }
  if (pct >= 0.6) return { label: 'Good', emoji: '🥈' }
  if (pct >= 0.4) return { label: 'OK', emoji: '🥉' }
  return { label: 'Keep practicing', emoji: '🎨' }
}

function loadStats() {
  try {
    const s = localStorage.getItem('colorguesser_namequiz_stats')
    return s ? { gamesPlayed: 0, bestScore: 0, totalScore: 0, ...JSON.parse(s) } : { gamesPlayed: 0, bestScore: 0, totalScore: 0 }
  } catch {
    return { gamesPlayed: 0, bestScore: 0, totalScore: 0 }
  }
}

function saveStats(stats) {
  localStorage.setItem('colorguesser_namequiz_stats', JSON.stringify(stats))
}

// Weighted Euclidean RGB distance — human perception (green ~4× more sensitive)
function colorDist(a, b) {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db)
}

// Precompute 10 nearest neighbors for every color (runs once at module load)
const nearestNeighbors = colors.map((c, i) =>
  colors
    .map((other, j) => ({ j, dist: colorDist(c, other) }))
    .filter(x => x.j !== i)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 10)
    .map(x => x.j)
)

function buildRounds(count) {
  // Shuffle indices so we get a random selection of correct colors
  const indices = [...colors.keys()].sort(() => Math.random() - 0.5).slice(0, count)
  return indices.map(correctIdx => {
    const correct = colors[correctIdx]
    // Pick 3 distractors randomly from the 10 nearest (most similar) colors
    const distractors = [...nearestNeighbors[correctIdx]]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(j => colors[j])
    const options = [correct, ...distractors].sort(() => Math.random() - 0.5)
    return { correct, options }
  })
}

export default function ColorNameQuiz() {
  const [phase, setPhase] = useState('playing') // playing | result | gameover
  const [rounds] = useState(() => buildRounds(TOTAL_ROUNDS))
  const [currentRound, setCurrentRound] = useState(0)
  const [picked, setPicked] = useState(null) // index in options array
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
    // Auto-confirm with no pick (score 0)
    if (picked === null) {
      handlePick(null)
    }
  }

  function handlePick(idx) {
    if (phase !== 'playing') return
    const round = rounds[currentRound]
    const isCorrect = idx !== null && round.options[idx] === round.correct
    setPicked(idx)
    setResults((prev) => [
      ...prev,
      {
        colorName: round.correct.name,
        correct: round.correct,
        isCorrect,
        score: isCorrect ? POINTS_PER_ROUND : 0,
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
      setPicked(null)
      setPhase('playing')
    }
  }

  function handlePlayAgain() {
    window.location.hash = '#/colorguesser/namequiz'
    window.location.reload()
  }

  // Save stats on gameover
  useEffect(() => {
    if (phase !== 'gameover') return
    const totalScore = results.reduce((s, r) => s + r.score, 0)
    const prev = loadStats()
    const next = {
      gamesPlayed: prev.gamesPlayed + 1,
      bestScore: Math.max(prev.bestScore, totalScore),
      totalScore: prev.totalScore + totalScore,
    }
    saveStats(next)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const round = rounds[currentRound]
  const totalScore = results.reduce((s, r) => s + r.score, 0)

  // ── Game Over ─────────────────────────────────────────────────────────────
  if (phase === 'gameover') {
    const rating = getRating(totalScore)
    return (
      <div className="min-h-screen bg-paper font-body flex flex-col">
        <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
          <a href="#/colorguesser" className="text-accent hover:underline text-sm font-medium">← Back</a>
          <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">🏷️ Color Name Quiz</h1>
          <div className="text-sm text-ink/60 w-16 text-right">Final</div>
        </header>

        <div className="flex-1 overflow-auto px-4 py-6 max-w-xl mx-auto w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-1">{rating.emoji}</div>
            <div className="font-display text-3xl font-bold text-ink">{totalScore.toLocaleString()}</div>
            <div className="text-ink/60 text-sm mt-1">
              out of {(TOTAL_ROUNDS * POINTS_PER_ROUND).toLocaleString()} · {rating.label}
            </div>
            <div className="mt-3 mx-auto max-w-xs">
              <div className="w-full bg-ink/10 rounded-full h-2">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${(totalScore / (TOTAL_ROUNDS * POINTS_PER_ROUND)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-ink/10 rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-2 bg-canvas border-b border-ink/10">
              <span className="text-xs font-semibold text-ink/60 uppercase tracking-wide">Results</span>
            </div>
            <div className="divide-y divide-ink/5">
              {results.map((r, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex-none border border-ink/10"
                    style={{ background: toHex(r.correct.r, r.correct.g, r.correct.b) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{r.colorName}</div>
                    <div className="text-xs text-ink/50">{toHex(r.correct.r, r.correct.g, r.correct.b).toUpperCase()}</div>
                  </div>
                  <div className="text-xl">{r.isCorrect ? '✅' : '❌'}</div>
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
  const correctIdx = round.options.indexOf(round.correct)

  return (
    <div className="min-h-screen bg-paper font-body flex flex-col">
      <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
        <a href="#/colorguesser" className="text-accent hover:underline text-sm font-medium">← Back</a>
        <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">🏷️ Color Name Quiz</h1>
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
        {/* Color name prompt */}
        <div className="text-center">
          {phase === 'playing' && (
            <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold bg-white border border-ink/10 tabular-nums mb-3 ${timeLeft <= 10 ? 'text-red-500' : 'text-ink'}`}>
              {timeLeft}s
            </div>
          )}
          <div className="font-display text-2xl md:text-3xl font-bold text-ink">
            {round.correct.name}
          </div>
          <div className="text-ink/50 text-sm mt-1">Which swatch matches this color name?</div>
        </div>

        {/* 4 color swatches */}
        <div className="grid grid-cols-2 gap-3">
          {round.options.map((opt, idx) => {
            const hex = toHex(opt.r, opt.g, opt.b)
            const isCorrectOpt = idx === correctIdx
            const isPickedOpt = idx === picked

            let borderClass = 'border-2 border-transparent'
            let overlay = null

            if (phase === 'result') {
              if (isCorrectOpt) {
                borderClass = 'border-2 border-green-500 ring-2 ring-green-400'
                overlay = (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl drop-shadow">✓</span>
                  </div>
                )
              } else if (isPickedOpt && !isCorrectOpt) {
                borderClass = 'border-2 border-red-500 ring-2 ring-red-400 opacity-70'
                overlay = (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl drop-shadow">✗</span>
                  </div>
                )
              } else {
                borderClass = 'border-2 border-transparent opacity-40'
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handlePick(idx)}
                disabled={phase !== 'playing'}
                className={`relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-default disabled:hover:scale-100 ${borderClass}`}
                style={{ background: hex, aspectRatio: '1' }}
                aria-label={phase === 'result' ? opt.name : `Color option ${idx + 1}`}
              >
                {overlay}
              </button>
            )
          })}
        </div>

        {/* Result feedback */}
        {phase === 'result' && (
          <div className="bg-white border border-ink/10 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex-none border border-ink/10"
                style={{ background: toHex(round.correct.r, round.correct.g, round.correct.b) }}
              />
              <div>
                <div className="text-sm font-semibold text-ink">{round.correct.name}</div>
                <div className="text-xs text-ink/50">{toHex(round.correct.r, round.correct.g, round.correct.b).toUpperCase()}</div>
              </div>
              <div className="ml-auto text-2xl">
                {results[results.length - 1]?.isCorrect ? '✅' : '❌'}
              </div>
            </div>
            <button
              onClick={handleNext}
              className="w-full bg-accent text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              {currentRound + 1 >= TOTAL_ROUNDS ? 'See results →' : 'Next →'}
            </button>
          </div>
        )}

        {/* Score tally */}
        <div className="text-center text-sm text-ink/50">
          Score: {totalScore.toLocaleString()} / {((currentRound + (phase === 'result' ? 1 : 0)) * POINTS_PER_ROUND).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
