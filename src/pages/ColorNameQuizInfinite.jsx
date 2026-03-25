import { useEffect, useRef, useState } from 'react'
import { colors } from '../data/colors'

const ROUND_TIME = 15  // tighter timer for infinite mode
const GAME_URL = 'https://ismailsunni.id/games/#/colorguesser'

function streakToEmojis(streak) {
  if (streak === 0) return '💀'
  const full = Math.min(Math.floor(streak / 2), 10)
  const half = streak % 2 === 1 && full < 10 ? 1 : 0
  return '🔥'.repeat(full) + (half ? '✨' : '')
}

async function generateScoreCard(streak, reverse) {
  const SIZE = 1080, PAD = 80
  const canvas = document.createElement('canvas')
  canvas.width = SIZE; canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, SIZE, SIZE)
  let y = PAD
  // Title
  ctx.font = 'bold 44px system-ui, sans-serif'; ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'left'
  ctx.fillText('🎨 Color Name Quiz', PAD, y + 44); y += 80
  // Mode
  ctx.font = '28px system-ui, sans-serif'; ctx.fillStyle = '#94a3b8'
  ctx.fillText(reverse ? 'Swatch → Name  ·  Infinite' : 'Name → Swatch  ·  Infinite', PAD, y + 28); y += 70
  // Divider
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(SIZE - PAD, y); ctx.stroke(); y += 50
  // Streak number
  ctx.textAlign = 'center'
  ctx.font = 'bold 160px system-ui, sans-serif'
  ctx.fillStyle = streak > 0 ? '#f59e0b' : '#ef4444'
  ctx.fillText(streak, SIZE / 2, y + 160); y += 200
  ctx.font = '36px system-ui, sans-serif'; ctx.fillStyle = '#94a3b8'
  ctx.fillText('correct in a row', SIZE / 2, y); y += 80
  // Emoji bar
  ctx.font = '56px system-ui, sans-serif'
  ctx.fillText(streakToEmojis(streak) || '—', SIZE / 2, y + 56); y += 120
  // Divider
  ctx.strokeStyle = '#334155'
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(SIZE - PAD, y); ctx.stroke(); y += 50
  // URL
  ctx.font = '26px system-ui, sans-serif'; ctx.fillStyle = '#475569'
  ctx.fillText(GAME_URL, SIZE / 2, y + 26)
  return canvas
}

function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function loadStats() {
  try {
    const s = localStorage.getItem('colorguesser_infinite_stats')
    return s ? { gamesPlayed: 0, bestStreak: 0, ...JSON.parse(s) } : { gamesPlayed: 0, bestStreak: 0 }
  } catch {
    return { gamesPlayed: 0, bestStreak: 0 }
  }
}

function saveStats(stats) {
  localStorage.setItem('colorguesser_infinite_stats', JSON.stringify(stats))
}

// Build a single fresh round, avoiding recently used indices
function buildRound(usedIndices) {
  const available = [...colors.keys()].filter(i => !usedIndices.has(i))
  const pool = available.length >= 1 ? available : [...colors.keys()]
  const correctIdx = pool[Math.floor(Math.random() * pool.length)]
  const correct = colors[correctIdx]
  const distractors = [...correct.neighbors]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(j => colors[j])
  const options = [correct, ...distractors].sort(() => Math.random() - 0.5)
  return { correct, options, correctIdx }
}

export default function ColorNameQuizInfinite({ reverse = false }) {
  const [phase, setPhase]       = useState('playing')  // playing | result | gameover
  const [streak, setStreak]     = useState(0)
  const [shareStatus, setShareStatus] = useState(null) // null | 'generating' | 'copied' | 'downloaded'
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
  const [picked, setPicked]     = useState(null)
  const [wrongColor, setWrongColor] = useState(null)  // the color that ended the run
  const [round, setRound]       = useState(() => buildRound(new Set()))
  const usedRef                 = useRef(new Set([]))
  const onTimerExpireRef        = useRef(null)

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return
    setTimeLeft(ROUND_TIME)
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); onTimerExpireRef.current?.(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, round])  // eslint-disable-line

  onTimerExpireRef.current = () => {
    if (picked === null) handlePick(null)
  }

  function handlePick(idx) {
    if (phase !== 'playing') return
    const isCorrect = idx !== null && round.options[idx] === round.correct
    setPicked(idx)
    setPhase('result')
    if (!isCorrect) {
      setWrongColor(round.correct)
    }
  }

  function handleNext() {
    const lastResult = picked === null ? false : round.options[picked] === round.correct
    if (!lastResult) {
      // Wrong — game over
      const newStreak = streak  // already not incremented
      const prev = loadStats()
      saveStats({
        gamesPlayed: prev.gamesPlayed + 1,
        bestStreak: Math.max(prev.bestStreak, newStreak),
      })
      setPhase('gameover')
    } else {
      // Correct — next round
      usedRef.current.add(round.correctIdx)
      // Keep window at last 20 used to allow repeats eventually
      if (usedRef.current.size > 20) {
        const first = usedRef.current.values().next().value
        usedRef.current.delete(first)
      }
      setStreak(s => s + 1)
      setRound(buildRound(usedRef.current))
      setPicked(null)
      setPhase('playing')
    }
  }

  async function handleShareImage() {
    setShareStatus('generating')
    const canvas = await generateScoreCard(streak, reverse)
    canvas.toBlob(async blob => {
      const file = new File([blob], 'color-quiz-streak.png', { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Color Name Quiz' }); setShareStatus(null); return }
        catch (e) { if (e.name === 'AbortError') { setShareStatus(null); return } }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = 'color-quiz-streak.png'; a.click()
      setShareStatus('downloaded'); setTimeout(() => setShareStatus(null), 3000)
    })
  }

  async function handleShareText() {
    const mode = reverse ? 'Swatch→Name' : 'Name→Swatch'
    const text = [
      `🎨 Color Name Quiz — ${mode} Infinite`,
      `Streak: ${streak} ${streakToEmojis(streak)}`,
      GAME_URL,
    ].join('\n')
    if (navigator.share) {
      try { await navigator.share({ text }); return } catch {}
    }
    navigator.clipboard.writeText(text).catch(() => {})
    setShareStatus('copied'); setTimeout(() => setShareStatus(null), 3000)
  }

  function handlePlayAgain() {
    usedRef.current = new Set()
    setStreak(0)
    setRound(buildRound(new Set()))
    setPicked(null)
    setWrongColor(null)
    setPhase('playing')
  }

  const correctIdx = round.options.indexOf(round.correct)
  const lastIsCorrect = picked !== null && round.options[picked] === round.correct
  const stats = loadStats()

  // ── Game Over ─────────────────────────────────────────────────────────────
  if (phase === 'gameover') {
    const isNewBest = streak >= stats.bestStreak
    return (
      <div className="min-h-screen bg-paper font-body flex flex-col">
        <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
          <a href={reverse ? '#/colorguesser/swatchquiz' : '#/colorguesser/namequiz'} className="text-accent hover:underline text-sm font-medium">← Back</a>
          <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">
            ♾️ {reverse ? 'Swatch → Name' : 'Name → Swatch'}
          </h1>
          <div className="w-12" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 max-w-md mx-auto w-full gap-6">
          <div className="text-center">
            <div className="text-5xl mb-3">{streak === 0 ? '😅' : streak < 5 ? '🙂' : streak < 10 ? '🔥' : '🏆'}</div>
            <div className="font-display text-5xl font-bold text-ink">{streak}</div>
            <div className="text-ink/50 mt-1">{streak === 1 ? 'correct in a row' : 'correct in a row'}</div>
            {isNewBest && streak > 0 && (
              <div className="mt-2 text-sm font-bold text-green-600 animate-pulse">🎉 New best!</div>
            )}
            {!isNewBest && (
              <div className="mt-2 text-sm text-ink/40">Best: {stats.bestStreak}</div>
            )}
          </div>

          {wrongColor && (
            <div className="bg-white border border-red-100 rounded-xl p-4 flex items-center gap-3 w-full">
              <div
                className="w-12 h-12 rounded-lg flex-none border border-ink/10"
                style={{ background: toHex(wrongColor.r, wrongColor.g, wrongColor.b) }}
              />
              <div>
                <div className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-0.5">You missed</div>
                <div className="text-sm font-semibold text-ink">{wrongColor.name}</div>
                <div className="text-xs text-ink/40">{toHex(wrongColor.r, wrongColor.g, wrongColor.b).toUpperCase()}</div>
                {wrongColor.description && (
                  <div className="text-xs text-ink/60 italic mt-1">{wrongColor.description}</div>
                )}
              </div>
            </div>
          )}

          {/* Share buttons */}
          <div className="text-xs font-semibold text-ink/40 uppercase tracking-wider text-center">Share your result</div>
          <div className="flex gap-2 w-full">
            <button
              onClick={handleShareImage}
              disabled={shareStatus === 'generating'}
              className="flex-1 bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white font-semibold py-3 px-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
            >
              {shareStatus === 'generating' ? '⏳' : shareStatus === 'downloaded' ? '✓ Saved!' : '📸 Image'}
            </button>
            <button
              onClick={handleShareText}
              className="flex-1 border border-ink/20 text-ink font-semibold py-3 px-3 rounded-lg hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-1.5 text-sm"
            >
              {shareStatus === 'copied' ? '✓ Copied!' : '📋 Text'}
            </button>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handlePlayAgain}
              className="w-full bg-accent text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
            <a
              href={reverse ? '#/colorguesser/swatchquiz' : '#/colorguesser/namequiz'}
              className="w-full text-center border border-ink/20 text-ink font-medium py-3 rounded-lg hover:border-accent hover:text-accent transition-colors"
            >
              ← Modes
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Playing / Result ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-paper font-body flex flex-col">
      <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
        <a href={reverse ? '#/colorguesser/swatchquiz' : '#/colorguesser/namequiz'} className="text-accent hover:underline text-sm font-medium">← Back</a>
        <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">
          ♾️ {reverse ? 'Swatch → Name' : 'Name → Swatch'}
        </h1>
        <div className="text-sm font-bold text-ink/70 w-12 text-right">🔥 {streak}</div>
      </header>

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
        {/* Prompt */}
        <div className="text-center">
          {phase === 'playing' && (
            <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold bg-white border border-ink/10 tabular-nums mb-3 ${timeLeft <= 5 ? 'text-red-500' : 'text-ink'}`}>
              {timeLeft}s
            </div>
          )}
          {reverse ? (
            <div className="flex justify-center">
              <div
                className="w-32 h-32 rounded-2xl border border-ink/10 shadow-md"
                style={{ background: toHex(round.correct.r, round.correct.g, round.correct.b) }}
              />
            </div>
          ) : (
            <div className="font-display text-2xl md:text-3xl font-bold text-ink">
              {round.correct.name}
            </div>
          )}
          <div className="text-ink/50 text-sm mt-3">
            {reverse ? 'What is the name of this color?' : 'Which swatch matches this color name?'}
          </div>
        </div>

        {/* Options */}
        {reverse ? (
          <div className="flex flex-col gap-3">
            {round.options.map((opt, idx) => {
              const isCorrectOpt = idx === correctIdx
              const isPickedOpt  = idx === picked
              let cls = 'w-full py-4 px-5 rounded-xl border-2 text-left font-medium text-sm transition-all'
              if (phase === 'result') {
                if (isCorrectOpt)     cls += ' border-green-500 bg-green-50 text-green-700'
                else if (isPickedOpt) cls += ' border-red-400 bg-red-50 text-red-600 opacity-80'
                else                  cls += ' border-ink/10 text-ink/30 opacity-50'
              } else {
                cls += ' border-ink/15 bg-white hover:border-accent hover:text-accent cursor-pointer active:scale-[0.98]'
              }
              return (
                <button key={idx} onClick={() => handlePick(idx)} disabled={phase !== 'playing'} className={cls}>
                  <span className="flex items-center gap-3">
                    {opt.name}
                    {phase === 'result' && isCorrectOpt  && <span className="ml-auto">✓</span>}
                    {phase === 'result' && isPickedOpt && !isCorrectOpt && <span className="ml-auto">✗</span>}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {round.options.map((opt, idx) => {
              const hex = toHex(opt.r, opt.g, opt.b)
              const isCorrectOpt = idx === correctIdx
              const isPickedOpt  = idx === picked
              let borderClass = 'border-2 border-transparent'
              let overlay = null
              if (phase === 'result') {
                if (isCorrectOpt) {
                  borderClass = 'border-2 border-green-500 ring-2 ring-green-400'
                  overlay = <div className="absolute inset-0 flex items-center justify-center"><span className="text-3xl drop-shadow">✓</span></div>
                } else if (isPickedOpt) {
                  borderClass = 'border-2 border-red-500 ring-2 ring-red-400 opacity-70'
                  overlay = <div className="absolute inset-0 flex items-center justify-center"><span className="text-3xl drop-shadow">✗</span></div>
                } else {
                  borderClass = 'border-2 border-transparent opacity-40'
                }
              }
              return (
                <button key={idx} onClick={() => handlePick(idx)} disabled={phase !== 'playing'}
                  className={`relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-default disabled:hover:scale-100 ${borderClass}`}
                  style={{ background: hex, aspectRatio: '1' }}
                  aria-label={phase === 'result' ? opt.name : `Color option ${idx + 1}`}
                >
                  {overlay}
                </button>
              )
            })}
          </div>
        )}

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
                {round.correct.description && (
                  <div className="text-xs text-ink/60 italic mt-1">{round.correct.description}</div>
                )}
              </div>
              <div className="ml-auto text-2xl">{lastIsCorrect ? '✅' : '❌'}</div>
            </div>
            <button
              onClick={handleNext}
              className={`w-full font-semibold py-3 rounded-lg transition-opacity hover:opacity-90 ${lastIsCorrect ? 'bg-accent text-white' : 'bg-red-500 text-white'}`}
            >
              {lastIsCorrect ? `Next → (streak: ${streak + 1})` : 'See results'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
