import { useEffect, useMemo, useState } from 'react'
import { answers as answerText } from '../data/semantika.json'

const DIM = 128
const TOP = 1000
const ANSWERS = answerText.split(' ')

const today = () => new Date().toLocaleDateString('en-CA')
const load = (key) => { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }
const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

function dailyAnswer(date) {
  let h = 2166136261
  for (const ch of `semantika-${date}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return ANSWERS[(h >>> 0) % ANSWERS.length]
}

async function loadModel() {
  const base = import.meta.env.BASE_URL
  const [text, buf] = await Promise.all([
    fetch(`${base}semantika/words.txt`).then((r) => r.text()),
    fetch(`${base}semantika/vectors.bin`).then((r) => r.arrayBuffer()),
  ])
  const words = text.split('\n')
  const vec = new Int8Array(buf)
  const norm = new Float32Array(words.length)
  for (let i = 0; i < words.length; i++) {
    let s = 0
    for (let d = i * DIM; d < (i + 1) * DIM; d++) s += vec[d] * vec[d]
    norm[i] = Math.sqrt(s)
  }
  return { words, vec, norm, index: new Map(words.map((w, i) => [w, i])) }
}

function target({ words, vec, norm, index }, answer) {
  const a = index.get(answer)
  const sims = new Float32Array(words.length)
  for (let i = 0; i < words.length; i++) {
    let s = 0
    for (let d = 0; d < DIM; d++) s += vec[i * DIM + d] * vec[a * DIM + d]
    sims[i] = (s / (norm[i] * norm[a])) * 100
  }
  const order = [...sims.keys()].sort((x, y) => sims[y] - sims[x]).slice(1, TOP + 1)
  return {
    answer,
    sims,
    rank: new Map(order.map((i, r) => [i, TOP - r])),
    nearest: order.slice(0, 10).map((i) => words[i]),
    marks: [order[0], order[9], order[TOP - 1]].map((i) => sims[i]),
  }
}

function Closeness({ g }) {
  if (g.word === g.answer) return <span className="font-semibold text-emerald-600">🎯 Found!</span>
  if (!g.rank) return <span className="text-ink/40">{g.sim > 0 ? '😐 tepid' : '🥶 cold'}</span>
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-ink/10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500" style={{ width: `${g.rank / 10}%` }} />
      </div>
      <span className="w-16 text-right tabular-nums text-ink/70">{g.rank}/{TOP}</span>
    </div>
  )
}

function Row({ g, highlight }) {
  return (
    <tr className={highlight ? 'bg-accent/10' : ''}>
      <td className="py-1.5 pr-2 text-ink/40 tabular-nums">{g.n}</td>
      <td className="py-1.5 pr-2 font-semibold text-ink">{g.word}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{g.sim.toFixed(2)}</td>
      <td className="py-1.5 w-1/2"><Closeness g={g} /></td>
    </tr>
  )
}

function ShareButton({ label, guesses, won }) {
  const [copied, setCopied] = useState(false)
  const firstAt = (pred) => guesses.findIndex(pred) + 1 || '–'
  const text = [
    `🧠 Semantika ${label}`,
    won ? `Found it in ${guesses.length} guesses` : `Gave up after ${guesses.length} guesses`,
    `First guess: ${guesses[0]?.sim.toFixed(2) ?? '–'}`,
    `Top 1000 at guess #${firstAt((g) => g.rank)} · top 10 at #${firstAt((g) => g.rank > TOP - 10)}`,
    `${location.origin}${location.pathname}#/semantika`,
  ].join('\n')
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

function Game({ model, answer, initial, onChange, onRestart, label }) {
  const t = useMemo(() => target(model, answer), [model, answer])
  const [state, setState] = useState(initial || { words: [], gaveUp: false })
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState('')

  const guesses = state.words.map((word, n) => {
    const i = model.index.get(word)
    return { n: n + 1, word, answer, sim: t.sims[i], rank: t.rank.get(i) }
  })
  const won = state.words.includes(answer)
  const over = won || state.gaveUp
  const latest = guesses.at(-1)

  function update(next) {
    setState(next)
    onChange?.(next)
  }

  function submit(e) {
    e.preventDefault()
    const word = input.trim().toLowerCase()
    setInput('')
    if (!word) return
    if (!model.index.has(word)) return setMsg(`“${word}” isn't in the word list`)
    if (state.words.includes(word)) return setMsg(`Already guessed “${word}”`)
    setMsg('')
    update({ ...state, words: [...state.words, word] })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/60">
        Nearest word scores <b className="text-ink">{t.marks[0].toFixed(2)}</b>, the 10th nearest{' '}
        <b className="text-ink">{t.marks[1].toFixed(2)}</b>, the 1000th <b className="text-ink">{t.marks[2].toFixed(2)}</b>.
      </p>

      {over ? (
        <div className="rounded-2xl border border-ink/10 bg-surface p-4 space-y-3 text-center">
          <p className="font-display text-xl font-bold text-ink">
            {won ? `🎉 “${answer}” in ${guesses.length} guesses!` : `The word was “${answer}”`}
          </p>
          <p className="text-sm text-ink/60">Nearest words: {t.nearest.join(', ')}</p>
          <div className="flex justify-center gap-2">
            <ShareButton label={label} guesses={guesses} won={won} />
            {onRestart && <button onClick={onRestart} className="border border-ink/20 px-4 py-2 rounded-lg font-semibold text-ink hover:border-accent">New word</button>}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tebak kata…"
            autoFocus
            autoCapitalize="none"
            autoComplete="off"
            className="flex-1 min-w-0 rounded-lg border border-ink/15 bg-surface px-4 py-2.5 text-ink outline-none focus:border-accent"
          />
          <button className="bg-accent text-white px-4 rounded-lg font-semibold hover:opacity-90">Guess</button>
          {guesses.length > 0 && (
            <button type="button" onClick={() => update({ ...state, gaveUp: true })} className="border border-ink/20 px-3 rounded-lg text-sm text-ink/60 hover:border-accent">Give up</button>
          )}
        </form>
      )}
      {msg && <p className="text-sm text-rose-500">{msg}</p>}

      {guesses.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-ink/40">
              <th className="pb-1 pr-2 font-semibold">#</th>
              <th className="pb-1 pr-2 font-semibold">Word</th>
              <th className="pb-1 pr-3 font-semibold text-right">Similarity</th>
              <th className="pb-1 font-semibold">Closeness</th>
            </tr>
          </thead>
          <tbody>
            {latest && <Row g={latest} highlight />}
            <tr><td colSpan={4} className="border-b border-ink/10" /></tr>
            {[...guesses].sort((a, b) => b.sim - a.sim).map((g) => <Row key={g.word} g={g} highlight={g === latest} />)}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Daily({ model }) {
  const date = today()
  const key = `semantika-${date}`
  return <Game model={model} answer={dailyAnswer(date)} initial={load(key)} onChange={(s) => save(key, s)} label={date} />
}

function Practice({ model }) {
  const pick = () => ANSWERS[Math.floor(Math.random() * ANSWERS.length)]
  const [answer, setAnswer] = useState(pick)
  return <Game key={answer} model={model} answer={answer} onRestart={() => setAnswer(pick())} label="(practice)" />
}

export default function Semantika() {
  const [model, setModel] = useState(null)
  const [mode, setMode] = useState('daily')

  useEffect(() => { loadModel().then(setModel) }, [])

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="app-header px-4 py-3 flex items-center gap-3">
        <a href="#/" className="back-link">← Games</a>
        <h1 className="font-display text-lg sm:text-xl font-bold text-ink whitespace-nowrap">🧠 Semantika</h1>
      </header>
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-8 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-ink/60">Guess the secret Indonesian word. Each guess shows how close its <i>meaning</i> is — not its spelling.</p>
          <div className="shrink-0 flex rounded-lg border border-ink/10 overflow-hidden text-sm">
            {['daily', 'practice'].map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 font-semibold capitalize ${mode === m ? 'bg-ink text-paper' : 'text-ink/60'}`}>{m}</button>
            ))}
          </div>
        </div>
        {!model ? <p className="text-ink/50 py-16 text-center">Loading word meanings…</p>
          : mode === 'daily' ? <Daily model={model} /> : <Practice model={model} />}
        <p className="pt-6 text-center text-xs text-ink/40">
          Word vectors:{' '}
          <a href="https://fasttext.cc/docs/en/crawl-vectors.html" className="underline hover:text-accent">fastText cc.id.300</a> (CC BY-SA 3.0)
          {' '}· Kata dari KBBI (Badan Bahasa, Kemendikbudristek) via{' '}
          <a href="https://github.com/damzaky/kumpulan-kata-bahasa-indonesia-KBBI" className="underline hover:text-accent">damzaky/kumpulan-kata-bahasa-indonesia-KBBI</a>
          {' '}· Frekuensi kata:{' '}
          <a href="https://github.com/hermitdave/FrequencyWords" className="underline hover:text-accent">hermitdave/FrequencyWords</a> (CC BY-SA 4.0)
        </p>
      </main>
    </div>
  )
}
