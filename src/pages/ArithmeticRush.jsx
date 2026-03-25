import { useEffect, useRef, useState } from 'react'

// ── Level config ─────────────────────────────────────────────────────────────
const LEVELS = [
  { id: 1, ops: ['+'],                 range: [1,  10],  timer: 10, chain: false, label: 'Addition',        desc: '1-digit numbers only' },
  { id: 2, ops: ['+', '−'],            range: [1,  20],  timer: 10, chain: false, label: 'Add & Subtract',  desc: 'Up to 20, no negatives' },
  { id: 3, ops: ['+', '−', '×'],       range: [1,  10],  timer: 12, chain: false, label: '× enters',        desc: 'Times tables up to 10' },
  { id: 4, ops: ['+', '−', '×'],       range: [1,  50],  timer: 12, chain: false, label: 'Bigger +−×',      desc: 'Two-digit numbers, no division' },
  { id: 5, ops: ['+', '−', '×', '÷'], range: [1,  12],  timer: 12, chain: false, label: 'All Four Ops',    desc: 'Division with whole answers' },
  { id: 6, ops: ['+', '−', '×', '÷'], range: [10, 99],  timer: 15, chain: false, label: 'Two-digit',       desc: 'All ops on two-digit numbers' },
  { id: 7, ops: ['+', '−', '×', '÷'], range: [100,500], timer: 15, chain: false, label: 'Three-digit',     desc: 'Large number arithmetic' },
  { id: 8, ops: ['+', '−', '×', '÷'], range: [1,  20],  timer: 20, chain: true,  label: 'Chained',         desc: 'Two ops: a ○ b ○ c = ?' },
]

const TOTAL_ROUNDS  = 5
const POINTS_BASE   = 1000
const SPEED_BONUS   = 500
const UNLOCK_THRESH = 3   // correct out of 5 to unlock next level

// ── Math helpers ─────────────────────────────────────────────────────────────
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)) }
function toEval(op) { return op === '×' ? '*' : op === '÷' ? '/' : op === '−' ? '-' : '+' }

function buildOptions(answer) {
  const spread = Math.max(3, Math.ceil(Math.abs(answer) * 0.18))
  const pool = []
  for (let d = 1; d <= spread * 5; d++) {
    if (answer + d > 0) pool.push(answer + d)
    if (answer - d > 0) pool.push(answer - d)
  }
  const wrongs = pool.sort(() => Math.random() - 0.5).slice(0, 3)
  while (wrongs.length < 3) wrongs.push(answer + wrongs.length + 1)
  return [answer, ...wrongs].sort(() => Math.random() - 0.5)
}

function generateQuestion(cfg) {
  const { ops, range, chain } = cfg
  const [min, max] = range

  for (let attempt = 0; attempt < 600; attempt++) {
    try {
      let expr, answer

      if (chain) {
        const op1 = ops[Math.floor(Math.random() * ops.length)]
        const op2 = ops[Math.floor(Math.random() * ops.length)]
        const a = randInt(min, max)
        const b = randInt(Math.max(min, 2), max)
        const c = randInt(Math.max(min, 2), max)
        // Enforce clean division
        if (op1 === '÷' && a % b !== 0) continue
        if (op2 === '÷') {
          // If op1 is + or −, then b ÷ c must be clean
          if (op1 === '+' || op1 === '−') { if (b % c !== 0) continue }
          // If op1 is × or ÷, then (a op1 b) ÷ c must be clean
          else {
            const partial = op1 === '×' ? a * b : a / b
            if (!Number.isInteger(partial) || partial % c !== 0) continue
          }
        }
        const ev = `${a}${toEval(op1)}${b}${toEval(op2)}${c}`
        // eslint-disable-next-line no-new-func
        const res = Function(`'use strict';return(${ev})`)()
        if (!Number.isInteger(res) || res < 1 || res > 9999) continue
        expr = `${a} ${op1} ${b} ${op2} ${c}`
        answer = res
      } else {
        const op = ops[Math.floor(Math.random() * ops.length)]
        let a, b
        if (op === '÷') {
          b = randInt(2, Math.min(max, 12))
          const maxQ = Math.floor(max / b)
          if (maxQ < 1) continue
          const q = randInt(1, maxQ)
          a = b * q
          if (a < min || a > max) continue
          answer = q
        } else if (op === '−') {
          a = randInt(min + 1, max)
          b = randInt(min, a - 1)
          answer = a - b
          if (answer < 1) continue
        } else if (op === '×') {
          a = randInt(min, max)
          b = randInt(min, max)
          answer = a * b
          if (answer > 9999) continue
        } else {
          a = randInt(min, max)
          b = randInt(min, max)
          answer = a + b
        }
        expr = `${a} ${op} ${b}`
      }
      return { expr, answer, options: buildOptions(answer) }
    } catch { continue }
  }
  // Fallback
  const a = randInt(1, 9), b = randInt(1, 9)
  const answer = a + b
  return { expr: `${a} + ${b}`, answer, options: buildOptions(answer) }
}

// ── Persistence ───────────────────────────────────────────────────────────────
function loadUnlocked()  { return parseInt(localStorage.getItem('arith_unlocked') || '1', 10) }
function saveUnlocked(n) { localStorage.setItem('arith_unlocked', String(Math.max(loadUnlocked(), n))) }
function loadStats()     { try { return JSON.parse(localStorage.getItem('arith_stats') || '{}') } catch { return {} } }
function saveStats(s)    { localStorage.setItem('arith_stats', JSON.stringify(s)) }

// ── Share helpers ─────────────────────────────────────────────────────────────
const GAME_URL = 'https://ismailsunni.id/games/#/arithmetic'

function scoreToEmojis(pct) {
  const filled = Math.round(pct * 5)
  return '⭐'.repeat(filled) + '☆'.repeat(5 - filled)
}

async function generateScoreCard({ mode, level, streak, score, results }) {
  const SIZE = 1080, PAD = 80
  const canvas = document.createElement('canvas')
  canvas.width = SIZE; canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, SIZE, SIZE)

  let y = PAD
  ctx.textAlign = 'left'

  ctx.font = 'bold 44px system-ui,sans-serif'; ctx.fillStyle = '#f59e0b'
  ctx.fillText('🔢 Arithmetic Rush', PAD, y + 44); y += 80

  ctx.font = '28px system-ui,sans-serif'; ctx.fillStyle = '#94a3b8'
  const lvl = LEVELS[level - 1]
  ctx.fillText(`Level ${level}: ${lvl.label}  ·  ${mode === '5q' ? '5 Questions' : 'Infinite'}`, PAD, y + 28); y += 60

  ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(SIZE - PAD, y); ctx.stroke(); y += 50

  if (mode === '5q') {
    const maxScore = TOTAL_ROUNDS * (POINTS_BASE + SPEED_BONUS)
    const pct = score / maxScore
    ctx.font = 'bold 120px system-ui,sans-serif'; ctx.fillStyle = '#f59e0b'; ctx.textAlign = 'center'
    ctx.fillText(score.toLocaleString(), SIZE / 2, y + 120); y += 145
    ctx.font = '30px system-ui,sans-serif'; ctx.fillStyle = '#64748b'
    ctx.fillText(`/ ${maxScore.toLocaleString()} pts`, SIZE / 2, y); y += 60
    ctx.font = '50px system-ui,sans-serif'
    ctx.fillText(scoreToEmojis(pct), SIZE / 2, y + 50); y += 100

    // Per-question row
    ctx.textAlign = 'left'; ctx.font = '26px system-ui,sans-serif'
    results.forEach((r, i) => {
      ctx.fillStyle = r.isCorrect ? '#22c55e' : '#ef4444'
      ctx.fillText(`${i + 1}. ${r.expr} = ${r.answer}  ${r.isCorrect ? `✓ +${r.points}` : `✗ (${r.userAnswer ?? '–'})`}`, PAD, y + 30)
      y += 44
    })
    y += 20
  } else {
    ctx.font = 'bold 160px system-ui,sans-serif'; ctx.fillStyle = streak > 0 ? '#f59e0b' : '#ef4444'; ctx.textAlign = 'center'
    ctx.fillText(streak, SIZE / 2, y + 160); y += 200
    ctx.font = '36px system-ui,sans-serif'; ctx.fillStyle = '#94a3b8'
    ctx.fillText('correct in a row', SIZE / 2, y); y += 70
    ctx.font = '50px system-ui,sans-serif'
    ctx.fillText('🔥'.repeat(Math.min(streak, 10)) || '💀', SIZE / 2, y + 50); y += 100
  }

  ctx.strokeStyle = '#1e3a5f'
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(SIZE - PAD, y); ctx.stroke(); y += 40
  ctx.font = '26px system-ui,sans-serif'; ctx.fillStyle = '#334155'; ctx.textAlign = 'center'
  ctx.fillText(GAME_URL, SIZE / 2, y + 26)
  return canvas
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ArithmeticRush() {
  const [phase, setPhase]     = useState('home')    // home | modeSelect | playing | feedback | gameover
  const [mode, setMode]       = useState('5q')
  const [level, setLevel]     = useState(1)
  const [questions, setQuestions] = useState([])    // 5q mode: all 5 upfront
  const [currentIdx, setCIdx] = useState(0)
  const [current, setCurrent] = useState(null)
  const [picked, setPicked]   = useState(null)
  const [score, setScore]     = useState(0)
  const [streak, setStreak]   = useState(0)
  const [results, setResults] = useState([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [shareStatus, setShareStatus] = useState(null)
  const [unlocked, setUnlocked] = useState(loadUnlocked)
  const [pendingLevel, setPendingLevel] = useState(null)  // level chosen, awaiting mode select
  const onExpireRef = useRef(null)

  const levelCfg = LEVELS[level - 1]

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return
    setTimeLeft(levelCfg.timer)
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); onExpireRef.current?.(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase, current]) // eslint-disable-line

  onExpireRef.current = () => { if (picked === null) handlePick(null) }

  function openLevel(lv) { setPendingLevel(lv); setPhase('modeSelect') }

  function startGame(lv, md) {
    const cfg = LEVELS[lv - 1]
    setLevel(lv); setMode(md)
    setScore(0); setStreak(0); setResults([])
    setPicked(null); setCIdx(0)
    if (md === '5q') {
      const qs = Array.from({ length: TOTAL_ROUNDS }, () => generateQuestion(cfg))
      setQuestions(qs); setCurrent(qs[0])
    } else {
      setCurrent(generateQuestion(cfg))
    }
    setPhase('playing')
  }

  function handlePick(optIdx) {
    if (phase !== 'playing') return
    const isCorrect = optIdx !== null && current.options[optIdx] === current.answer
    const speedBonus = isCorrect ? Math.round((timeLeft / levelCfg.timer) * SPEED_BONUS) : 0
    const points = isCorrect ? POINTS_BASE + speedBonus : 0
    setPicked(optIdx)
    const newResult = { expr: current.expr, answer: current.answer, userAnswer: optIdx !== null ? current.options[optIdx] : null, isCorrect, points, timeLeft }
    setResults(prev => [...prev, newResult])
    if (mode === '5q') setScore(s => s + points)
    else if (isCorrect) setStreak(s => s + 1)
    setPhase('feedback')
  }

  function handleNext() {
    const allResults = results  // already updated
    const last = allResults[allResults.length - 1]

    if (mode === 'infinite' && !last.isCorrect) {
      const st = loadStats()
      const key = `l${level}_inf`
      st[key] = { bestStreak: Math.max(st[key]?.bestStreak || 0, streak), gamesPlayed: (st[key]?.gamesPlayed || 0) + 1 }
      saveStats(st)
      setPhase('gameover'); return
    }

    if (mode === '5q') {
      const next = currentIdx + 1
      if (next >= TOTAL_ROUNDS) {
        const correct = allResults.filter(r => r.isCorrect).length
        if (correct >= UNLOCK_THRESH && level < 8) {
          const nu = Math.max(unlocked, level + 1)
          setUnlocked(nu); saveUnlocked(nu)
        }
        const st = loadStats(); const key = `l${level}_5q`
        st[key] = { bestScore: Math.max(st[key]?.bestScore || 0, score), gamesPlayed: (st[key]?.gamesPlayed || 0) + 1, bestCorrect: Math.max(st[key]?.bestCorrect || 0, correct) }
        saveStats(st)
        setPhase('gameover')
      } else {
        setCIdx(next); setCurrent(questions[next]); setPicked(null); setPhase('playing')
      }
    } else {
      setCurrent(generateQuestion(levelCfg)); setPicked(null); setPhase('playing')
    }
  }

  async function handleShareImage() {
    setShareStatus('generating')
    const canvas = await generateScoreCard({ mode, level, streak, score, results })
    canvas.toBlob(async blob => {
      const file = new File([blob], 'arithmetic-rush.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Arithmetic Rush' }); setShareStatus(null); return }
        catch (e) { if (e.name === 'AbortError') { setShareStatus(null); return } }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'arithmetic-rush.png'; a.click()
      setShareStatus('downloaded'); setTimeout(() => setShareStatus(null), 3000)
    })
  }

  async function handleShareText() {
    const lvl = LEVELS[level - 1]
    const lines = mode === '5q'
      ? [`🔢 Arithmetic Rush — Level ${level}: ${lvl.label}`, `Score: ${score.toLocaleString()} pts`, `${results.filter(r => r.isCorrect).length}/${TOTAL_ROUNDS} correct`, GAME_URL]
      : [`🔢 Arithmetic Rush — Level ${level}: ${lvl.label} (Infinite)`, `Streak: ${streak} ${'🔥'.repeat(Math.min(streak, 10)) || '💀'}`, GAME_URL]
    const text = lines.join('\n')
    if (navigator.share) { try { await navigator.share({ text }); return } catch {} }
    navigator.clipboard.writeText(text).catch(() => {})
    setShareStatus('copied'); setTimeout(() => setShareStatus(null), 3000)
  }

  // ── Render: Home ─────────────────────────────────────────────────────────
  if (phase === 'home') {
    const st = loadStats()
    return (
      <div className="min-h-screen bg-paper font-body flex flex-col">
        <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
          <a href="#/" className="text-accent hover:underline text-sm font-medium">← Back</a>
          <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">🔢 Arithmetic Rush</h1>
          <div className="w-12" />
        </header>
        <div className="flex-1 overflow-auto px-4 py-6 max-w-lg mx-auto w-full">
          <p className="text-ink/50 text-sm text-center mb-6">Pick a level — complete 5 questions with ≥3 correct to unlock the next</p>
          <div className="flex flex-col gap-3">
            {LEVELS.map(lv => {
              const locked = lv.id > unlocked
              const s5 = st[`l${lv.id}_5q`]
              const sinf = st[`l${lv.id}_inf`]
              return (
                <button key={lv.id} onClick={() => !locked && openLevel(lv.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${locked ? 'border-ink/10 bg-ink/5 opacity-50 cursor-not-allowed' : 'border-ink/15 bg-white hover:border-accent hover:shadow-sm cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-none ${locked ? 'bg-ink/10 text-ink/40' : 'bg-accent/10 text-accent'}`}>
                      {locked ? '🔒' : lv.id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink">{lv.label}</span>
                        {lv.chain && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-medium">CHAIN</span>}
                      </div>
                      <div className="text-xs text-ink/50">{lv.desc} · ⏱ {lv.timer}s</div>
                    </div>
                    {!locked && (s5 || sinf) && (
                      <div className="text-right text-[10px] text-ink/40 flex-none">
                        {s5 && <div>5Q best: {s5.bestScore?.toLocaleString()}</div>}
                        {sinf && <div>∞ streak: {sinf.bestStreak}</div>}
                      </div>
                    )}
                    {!locked && <span className="text-accent text-sm flex-none">›</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Mode select ───────────────────────────────────────────────────
  if (phase === 'modeSelect') {
    const lv = LEVELS[pendingLevel - 1]
    return (
      <div className="min-h-screen bg-paper font-body flex flex-col">
        <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
          <button onClick={() => setPhase('home')} className="text-accent hover:underline text-sm font-medium">← Back</button>
          <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">Level {pendingLevel}: {lv.label}</h1>
          <div className="w-12" />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 max-w-md mx-auto w-full gap-5">
          <p className="text-ink/50 text-sm text-center">{lv.desc} · {lv.ops.join(' ')} · ⏱ {lv.timer}s per question</p>

          <button onClick={() => startGame(pendingLevel, '5q')}
            className="w-full bg-white border border-ink/15 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group text-left">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🏁</div>
              <div>
                <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">5 Questions</div>
                <div className="text-sm text-ink/60 mt-1">Classic mode — score by speed + accuracy. 3/5 unlocks next level.</div>
              </div>
            </div>
          </button>

          <button onClick={() => startGame(pendingLevel, 'infinite')}
            className="w-full bg-white border border-ink/15 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group text-left">
            <div className="flex items-start gap-4">
              <div className="text-4xl">♾️</div>
              <div>
                <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">Infinite Mode</div>
                <div className="text-sm text-ink/60 mt-1">One wrong answer ends it. How long can you streak?</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── Render: Game Over ─────────────────────────────────────────────────────
  if (phase === 'gameover') {
    const lv = LEVELS[level - 1]
    const correct = results.filter(r => r.isCorrect).length
    const maxScore = TOTAL_ROUNDS * (POINTS_BASE + SPEED_BONUS)
    return (
      <div className="min-h-screen bg-paper font-body flex flex-col">
        <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
          <button onClick={() => setPhase('home')} className="text-accent hover:underline text-sm font-medium">← Levels</button>
          <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">🔢 Arithmetic Rush</h1>
          <div className="w-12" />
        </header>
        <div className="flex-1 overflow-auto px-4 py-6 max-w-md mx-auto w-full flex flex-col gap-5">

          {/* Score summary */}
          <div className="text-center">
            {mode === '5q' ? (
              <>
                <div className="font-display text-5xl font-bold text-ink">{score.toLocaleString()}</div>
                <div className="text-ink/50 text-sm mt-1">{correct}/{TOTAL_ROUNDS} correct · Level {level}: {lv.label}</div>
                <div className="text-2xl mt-2">{scoreToEmojis(score / maxScore)}</div>
                {correct >= UNLOCK_THRESH && level < 8 && (
                  <div className="mt-2 text-sm font-bold text-green-600 animate-pulse">🔓 Level {level + 1} unlocked!</div>
                )}
              </>
            ) : (
              <>
                <div className="font-display text-6xl font-bold text-ink">{streak}</div>
                <div className="text-ink/50 text-sm mt-1">correct in a row · Level {level}: {lv.label}</div>
                <div className="text-3xl mt-2">{'🔥'.repeat(Math.min(streak, 10)) || '💀'}</div>
              </>
            )}
          </div>

          {/* Per-question breakdown (5q) */}
          {mode === '5q' && (
            <div className="bg-white border border-ink/10 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-canvas border-b border-ink/10 text-xs font-semibold text-ink/50 uppercase tracking-wide">Results</div>
              {results.map((r, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3 border-b border-ink/5 last:border-0">
                  <div className="text-lg">{r.isCorrect ? '✅' : '❌'}</div>
                  <div className="flex-1 font-mono text-sm text-ink">{r.expr} = <strong>{r.answer}</strong></div>
                  <div className="text-xs text-ink/50 text-right">
                    {r.isCorrect ? <span className="text-green-600">+{r.points}</span> : <span className="text-red-400">{r.userAnswer ?? '–'}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Last wrong (infinite) */}
          {mode === 'infinite' && results.length > 0 && !results[results.length - 1].isCorrect && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm">
              <div className="text-red-400 font-semibold text-xs uppercase tracking-wide mb-1">You missed</div>
              <span className="font-mono text-ink">{results[results.length - 1].expr} = </span>
              <strong className="text-ink">{results[results.length - 1].answer}</strong>
              {results[results.length - 1].userAnswer !== null && (
                <span className="text-red-500 ml-2">(you picked {results[results.length - 1].userAnswer})</span>
              )}
            </div>
          )}

          {/* Share */}
          <div className="text-xs font-semibold text-ink/40 uppercase tracking-wider text-center">Share your result</div>
          <div className="flex gap-2">
            <button onClick={handleShareImage} disabled={shareStatus === 'generating'}
              className="flex-1 bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white font-semibold py-3 px-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center text-sm disabled:opacity-50">
              {shareStatus === 'generating' ? '⏳' : shareStatus === 'downloaded' ? '✓ Saved!' : '📸 Image'}
            </button>
            <button onClick={handleShareText}
              className="flex-1 border border-ink/20 text-ink font-semibold py-3 px-3 rounded-lg hover:border-accent hover:text-accent transition-colors flex items-center justify-center text-sm">
              {shareStatus === 'copied' ? '✓ Copied!' : '📋 Text'}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => startGame(level, mode)} className="flex-1 bg-accent text-white font-semibold py-3 rounded-xl hover:opacity-90">Play again</button>
            <button onClick={() => setPhase('home')} className="flex-1 border border-ink/20 text-ink font-medium py-3 rounded-xl hover:border-accent hover:text-accent">Levels</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Playing / Feedback ────────────────────────────────────────────
  const roundNum = mode === '5q' ? currentIdx + 1 : streak + 1
  const isCorrectOpt = picked !== null && current?.options[picked] === current?.answer
  const correctOptIdx = current?.options.indexOf(current?.answer)

  return (
    <div className="min-h-screen bg-paper font-body flex flex-col">
      <header className="border-b border-ink/10 bg-canvas px-3 py-2 flex items-center gap-2">
        <button onClick={() => setPhase('home')} className="text-accent hover:underline text-sm font-medium shrink-0">← Levels</button>
        <div className="flex-1 text-center text-sm font-semibold text-ink/60">
          L{level} · {mode === '5q' ? `${roundNum}/${TOTAL_ROUNDS}` : `🔥 ${streak}`}
        </div>
        {mode === '5q' && <div className="text-xs font-bold text-accent shrink-0">{score.toLocaleString()} pts</div>}
      </header>

      {/* Timer bar */}
      {phase === 'playing' && (
        <div className="h-1.5 bg-ink/10">
          <div className="h-full bg-accent transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / levelCfg.timer) * 100}%`, background: timeLeft <= 3 ? '#ef4444' : undefined }} />
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 py-6 max-w-xl mx-auto w-full flex flex-col gap-6">

        {/* Timer + Expression */}
        <div className="text-center">
          {phase === 'playing' && (
            <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold bg-white border border-ink/10 tabular-nums mb-3 ${timeLeft <= 3 ? 'text-red-500' : 'text-ink'}`}>
              {timeLeft}s
            </div>
          )}
          <div className="font-mono text-4xl md:text-5xl font-bold text-ink tracking-tight">
            {current?.expr} = ?
          </div>
          <div className="text-ink/40 text-sm mt-2">{levelCfg.label} · {levelCfg.ops.join(' ')}</div>
        </div>

        {/* Options — 2×2 grid */}
        <div className="grid grid-cols-2 gap-3">
          {current?.options.map((opt, idx) => {
            const isCorrectChoice = idx === correctOptIdx
            const isPickedChoice  = idx === picked
            let cls = 'rounded-xl py-6 text-center font-mono text-2xl font-bold border-2 transition-all'
            if (phase === 'feedback') {
              if (isCorrectChoice)    cls += ' border-green-500 bg-green-50 text-green-700'
              else if (isPickedChoice) cls += ' border-red-400 bg-red-50 text-red-500 opacity-80'
              else                    cls += ' border-ink/10 text-ink/30 opacity-50'
            } else {
              cls += ' border-ink/15 bg-white hover:border-accent hover:text-accent cursor-pointer active:scale-95'
            }
            return (
              <button key={idx} onClick={() => handlePick(idx)} disabled={phase !== 'playing'} className={cls}>
                {opt}
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {phase === 'feedback' && (
          <div className="bg-white border border-ink/10 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{isCorrectOpt ? '✅' : '❌'}</div>
              <div className="flex-1">
                <div className="font-mono font-semibold text-ink">{current.expr} = {current.answer}</div>
                {!isCorrectOpt && picked !== null && (
                  <div className="text-xs text-red-400 mt-0.5">You picked {current.options[picked]}</div>
                )}
                {picked === null && <div className="text-xs text-ink/40 mt-0.5">Time's up!</div>}
              </div>
              {isCorrectOpt && (
                <div className="text-xs text-right text-green-600 font-semibold">
                  +{POINTS_BASE}<br/>
                  <span className="text-ink/40">+{results[results.length-1]?.points - POINTS_BASE} speed</span>
                </div>
              )}
            </div>
            <button onClick={handleNext}
              className={`w-full font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity ${isCorrectOpt ? 'bg-accent text-white' : 'bg-red-500 text-white'}`}>
              {mode === 'infinite' && !isCorrectOpt ? 'See results' : mode === '5q' && currentIdx + 1 >= TOTAL_ROUNDS ? 'See results →' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
