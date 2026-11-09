import { useEffect, useMemo, useState } from 'react'

const BOARDS = 32
const MAX = 37
const KEYS = ['qwertyuiop', 'asdfghjkl', '↵zxcvbnm⌫']
const RANK = { x: 1, y: 2, g: 3 }
const TILE = { g: 'bg-emerald-500 text-white', y: 'bg-amber-400 text-white', x: 'bg-ink/25 text-ink/70' }
const DOT = { g: 'bg-emerald-500', y: 'bg-amber-400', x: 'bg-ink/30' }

const today = () => new Date().toLocaleDateString('en-CA')
const load = (key) => { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }
const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

function pick(pool, seed) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  const out = new Set()
  while (out.size < BOARDS) out.add(pool[Math.floor(rand() * pool.length)])
  return [...out]
}

function evaluate(guess, answer) {
  const res = Array(5).fill('x')
  const left = {}
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) res[i] = 'g'
    else left[answer[i]] = (left[answer[i]] || 0) + 1
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] !== 'g' && left[guess[i]] > 0) { res[i] = 'y'; left[guess[i]]-- }
  }
  return res
}

function Board({ answer, guesses, evals, solvedAt, input, over }) {
  const rows = solvedAt >= 0 ? guesses.slice(0, solvedAt + 1) : guesses
  return (
    <div className={`rounded-md p-0.5 sm:p-1 border ${solvedAt >= 0 ? 'border-emerald-500/50 opacity-60' : 'border-ink/10 bg-surface'}`}>
      <div className="grid grid-cols-5 gap-px">
        {rows.map((g, r) => [...g].map((c, i) => (
          <div key={`${r}${i}`} className={`aspect-square flex items-center justify-center rounded-sm font-bold uppercase text-[9px] sm:text-xs ${TILE[evals[r][i]]}`}>{c}</div>
        )))}
        {solvedAt < 0 && !over && [...input.padEnd(5)].map((c, i) => (
          <div key={`in${i}`} className="aspect-square flex items-center justify-center rounded-sm border border-ink/20 font-bold uppercase text-[9px] sm:text-xs text-ink">{c}</div>
        ))}
        {solvedAt < 0 && over && [...answer].map((c, i) => (
          <div key={`ans${i}`} className="aspect-square flex items-center justify-center rounded-sm bg-rose-500 text-white font-bold uppercase text-[9px] sm:text-xs">{c}</div>
        ))}
      </div>
    </div>
  )
}

function Key({ k, marks, onKey }) {
  const wide = k === '↵' || k === '⌫'
  return (
    <button
      onClick={() => onKey(k)}
      className={`relative h-12 ${wide ? 'flex-[1.5] text-lg' : 'flex-1'} rounded-md bg-ink/10 overflow-hidden font-bold uppercase text-ink`}
    >
      {marks && (
        <span className="absolute inset-0 grid grid-cols-8 grid-rows-4">
          {marks.map((m, i) => <span key={i} className={m ? DOT[m] : ''} />)}
        </span>
      )}
      <span className="relative [text-shadow:0_0_3px_rgb(var(--paper))]">{k}</span>
    </button>
  )
}

function ShareButton({ label, answers, solvedAt, used, won }) {
  const [copied, setCopied] = useState(false)
  const keycap = (n) => [...String(n).padStart(2, '0')].map((d) => `${d}️⃣`).join('')
  const cells = answers.map((_, b) => (solvedAt[b] >= 0 ? keycap(solvedAt[b] + 1) : '🟥🟥'))
  const rows = [0, 8, 16, 24].map((i) => cells.slice(i, i + 8).join(' '))
  const solved = solvedAt.filter((s) => s >= 0).length
  const text = `🇮🇩 KataTigaDua ${label}\n${solved}/${BOARDS} · ${won ? used : 'X'}/${MAX}\n${rows.join('\n')}\n${location.origin}${location.pathname}#/katatigadua`
  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ text })
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* share cancelled */ }
  }
  return (
    <button onClick={share} className="bg-accent text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90">
      {copied ? '✅ Copied!' : '📤 Share result'}
    </button>
  )
}

function Game({ words, answers, initial = [], onChange, onRestart, label }) {
  const [guesses, setGuesses] = useState(initial)
  const [input, setInput] = useState('')
  const [toast, setToast] = useState('')

  const evals = useMemo(() => answers.map((a) => guesses.map((g) => evaluate(g, a))), [answers, guesses])
  const solvedAt = answers.map((a) => guesses.indexOf(a))
  const solved = solvedAt.filter((s) => s >= 0).length
  const won = solved === BOARDS
  const over = won || guesses.length >= MAX

  const keyMarks = {}
  answers.forEach((_, b) => {
    if (solvedAt[b] >= 0) return
    guesses.forEach((g, r) => [...g].forEach((c, i) => {
      keyMarks[c] ??= Array(BOARDS).fill(null)
      const s = evals[b][r][i]
      if (RANK[s] > (RANK[keyMarks[c][b]] || 0)) keyMarks[c][b] = s
    }))
  })

  function flash(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 1500)
  }

  function onKey(k) {
    if (over) return
    if (k === '⌫') return setInput((s) => s.slice(0, -1))
    if (k === '↵') {
      if (input.length < 5) return flash('Not enough letters')
      if (!words.has(input)) return flash('Not in word list')
      const next = [...guesses, input]
      setGuesses(next)
      setInput('')
      onChange?.(next)
      return
    }
    if (input.length < 5) setInput((s) => s + k)
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Enter') onKey('↵')
      else if (e.key === 'Backspace') onKey('⌫')
      else if (/^[a-z]$/i.test(e.key)) onKey(e.key.toLowerCase())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <>
      <div className="flex items-center justify-between text-sm text-ink/60 mb-3">
        <span>Boards <b className="text-ink">{solved}/{BOARDS}</b></span>
        <span>Guesses <b className="text-ink">{guesses.length}/{MAX}</b></span>
      </div>

      {over && (
        <div className="mb-4 rounded-2xl border border-ink/10 bg-surface p-4 text-center space-y-3">
          <p className="font-display text-xl font-bold text-ink">
            {won ? `🎉 All 32 solved in ${guesses.length} guesses!` : `😵 ${solved}/32 solved`}
          </p>
          <div className="flex justify-center gap-2">
            <ShareButton label={label} answers={answers} solvedAt={solvedAt} used={guesses.length} won={won} />
            {onRestart && <button onClick={onRestart} className="border border-ink/20 px-4 py-2 rounded-lg font-semibold text-ink hover:border-accent">New game</button>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-8 items-start gap-1 sm:gap-2 pb-4">
        {answers.map((a, b) => (
          <Board key={a} answer={a} guesses={guesses} evals={evals[b]} solvedAt={solvedAt[b]} input={input} over={over} />
        ))}
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-ink text-paper px-4 py-2 rounded-lg text-sm font-semibold shadow-lg">{toast}</div>
      )}

      {!over && (
        <div className="sticky bottom-0 -mx-4 px-2 py-2 bg-paper/95 backdrop-blur border-t border-ink/10 space-y-1.5">
          {KEYS.map((row) => (
            <div key={row} className="flex gap-1 max-w-xl mx-auto">
              {[...row].map((k) => <Key key={k} k={k} marks={keyMarks[k]} onKey={onKey} />)}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Daily({ data }) {
  const date = today()
  const key = `katatigadua-${date}`
  const answers = useMemo(() => pick(data.answers, `kata-${date}`), [data, date])
  return <Game words={data.valid} answers={answers} initial={load(key) || []} onChange={(g) => save(key, g)} label={date} />
}

function Practice({ data }) {
  const [seed, setSeed] = useState(() => String(Math.random()))
  const answers = useMemo(() => pick(data.answers, seed), [data, seed])
  return <Game key={seed} words={data.valid} answers={answers} onRestart={() => setSeed(String(Math.random()))} label="(practice)" />
}

export default function KataTigaDua() {
  const [data, setData] = useState(null)
  const [mode, setMode] = useState('daily')

  useEffect(() => {
    import('../data/kata5.json').then(({ default: d }) => {
      const answers = d.answers.split(' ')
      setData({ answers, valid: new Set([...d.valid.split(' '), ...answers]) })
    })
  }, [])

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="app-header px-4 py-3 flex items-center gap-3">
        <a href="#/" className="back-link">← Games</a>
        <h1 className="font-display text-lg sm:text-xl font-bold text-ink whitespace-nowrap">🇮🇩 KataTigaDua</h1>
      </header>
      <main className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-sm text-ink/60">Solve 32 Indonesian words at once in {MAX} guesses. Every guess goes to every board.</p>
          <div className="shrink-0 flex rounded-lg border border-ink/10 overflow-hidden text-sm">
            {['daily', 'practice'].map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 font-semibold capitalize ${mode === m ? 'bg-ink text-paper' : 'text-ink/60'}`}>{m}</button>
            ))}
          </div>
        </div>
        {!data ? <p className="text-ink/50 py-16 text-center">Loading words…</p>
          : mode === 'daily' ? <Daily data={data} /> : <Practice data={data} />}
        <p className="py-6 text-center text-xs text-ink/40">
          Kata dari KBBI (Badan Bahasa, Kemendikbudristek) via{' '}
          <a href="https://github.com/damzaky/kumpulan-kata-bahasa-indonesia-KBBI" className="underline hover:text-accent">damzaky/kumpulan-kata-bahasa-indonesia-KBBI</a>
          {' '}· Frekuensi kata:{' '}
          <a href="https://github.com/hermitdave/FrequencyWords" className="underline hover:text-accent">hermitdave/FrequencyWords</a> (CC BY-SA 4.0)
        </p>
      </main>
    </div>
  )
}
