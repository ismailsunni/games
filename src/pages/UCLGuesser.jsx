import { useEffect, useMemo, useState } from 'react'

const MAX_GUESSES = 8
const MIN_SEASONS = 3 // answers are drawn from clubs with at least this many seasons
const STAGES = {
  R1: ['First round', 1], R2: ['Second round', 2], GS: ['Group stage', 3], GS1: ['First group stage', 3],
  LP: ['League phase', 3], PO: ['Knockout play-offs', 4], GS2: ['Second group stage', 5], R16: ['Round of 16', 5],
  QF: ['Quarter-finals', 6], SF: ['Semi-finals', 7], F: ['Final', 8],
}
const RANK_LABEL = ['', 'First round', 'Second round', 'Group stage', 'Play-offs', 'Last 16', 'Quarter-finals', 'Semi-finals', 'Final', 'Winner']

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const fmtSeason = (s) => `${s}–${String(s + 1).slice(2)}`
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtMatch = (m) => `${m.home} ${m.hs}–${m.as} ${m.away}${m.note ? ` (${m.note})` : ''}`
const today = () => new Date().toLocaleDateString('sv') // YYYY-MM-DD, local time

function buildDb({ countries, clubs, matches }) {
  const ms = matches.map(([date, season, stage, h, a, hs, as, note]) => ({
    date, season, stage, home: clubs[h][0], away: clubs[a][0], hs, as, note,
  }))
  const winners = new Set(ms.filter((m) => m.stage === 'F').map((m) => {
    const [ph, pa] = m.note?.startsWith('pens') ? m.note.slice(5).split('-').map(Number) : [m.hs, m.as]
    return `${m.season}|${ph > pa ? m.home : m.away}`
  }))
  const stats = Object.fromEntries(clubs.map(([name, cc]) => {
    const mine = ms.filter((m) => m.home === name || m.away === name)
    const seasons = [...new Set(mine.map((m) => m.season))]
    const titles = seasons.filter((s) => winners.has(`${s}|${name}`)).length
    return [name, {
      country: countries[cc],
      matches: mine,
      seasons: seasons.length,
      debut: seasons[0],
      titles,
      best: titles ? 9 : Math.max(...mine.map((m) => STAGES[m.stage][1])),
      opponents: new Set(mine.map((m) => (m.home === name ? m.away : m.home))),
    }]
  }))
  const names = clubs.map(([n]) => n)
  return { names, stats, pool: names.filter((n) => stats[n].seasons >= MIN_SEASONS), matchCount: ms.length }
}

function distance(stats, a, b) {
  const seen = new Set([a])
  let frontier = [a]
  for (let d = 0; frontier.length; d++) {
    if (frontier.includes(b)) return d
    frontier = frontier.flatMap((c) => [...stats[c].opponents]).filter((c) => !seen.has(c) && seen.add(c))
  }
  return Infinity
}

function hint({ stats }, guess, answer) {
  const g = stats[guess], a = stats[answer]
  const h2h = g.matches.filter((m) => m.home === answer || m.away === answer)
  const record = h2h.reduce((r, m) => {
    const [mine, theirs] = m.home === guess ? [m.hs, m.as] : [m.as, m.hs]
    r[mine > theirs ? 0 : mine === theirs ? 1 : 2]++
    return r
  }, [0, 0, 0])
  return {
    guess,
    country: [g.country, a.country],
    seasons: [g.seasons, a.seasons],
    debut: [g.debut, a.debut],
    best: [g.best, a.best],
    titles: [g.titles, a.titles],
    h2h,
    record,
    dist: h2h.length ? 1 : distance(stats, guess, answer),
  }
}

// Deterministic daily pick: hash of the date string into the answer pool
function dailyAnswer(pool, date) {
  let h = 2166136261
  for (const ch of `ucl-${date}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return pool[(h >>> 0) % pool.length]
}

const load = (key) => { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }
const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

function Chip({ label, value, pair: [g, a], arrows = true }) {
  const ok = g === a
  return (
    <div className={`rounded-md px-2 py-1.5 text-center ${ok ? 'bg-green-100 text-green-800' : 'bg-canvas text-ink'}`}>
      <div className="text-[10px] uppercase tracking-wider text-ink/40">{label}</div>
      <div className="text-sm font-semibold">{value} {!ok && arrows && (a > g ? '↑' : '↓')}</div>
    </div>
  )
}

function HintCard({ h, correct }) {
  const last = h.h2h.at(-1)
  return (
    <div className={`bg-white border rounded-lg p-3 ${correct ? 'border-green-500' : 'border-ink/10'}`}>
      <div className="font-display font-semibold text-ink mb-2">{correct && '✅ '}{h.guess}</div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Chip label="Country" value={h.country[0]} pair={h.country} arrows={false} />
        <Chip label="Seasons" value={h.seasons[0]} pair={h.seasons} />
        <Chip label="Debut" value={fmtSeason(h.debut[0])} pair={h.debut} />
        <Chip label="Best" value={RANK_LABEL[h.best[0]]} pair={h.best} />
        <Chip label="Titles" value={h.titles[0]} pair={h.titles} />
      </div>
      {!correct && (
        <div className="mt-2 text-sm text-ink/70">
          {h.h2h.length ? (
            <>
              <span className="font-semibold text-accent">Met {h.h2h.length}×</span>{' '}
              <span className="text-ink/50">({h.guess}: W{h.record[0]} D{h.record[1]} L{h.record[2]})</span>
              <div>Latest: {fmtMatch(last)} · {STAGES[last.stage][0]}, {fmtDate(last.date)}</div>
            </>
          ) : (
            <>Never met · <span className="font-semibold">{h.dist} steps</span> apart via common opponents</>
          )}
        </div>
      )}
    </div>
  )
}

function ClubInput({ db, exclude, onPick }) {
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const q = norm(text)
  const options = q
    ? db.names.filter((c) => !exclude.includes(c) && (norm(c).includes(q) || norm(db.stats[c].country).includes(q))).slice(0, 30)
    : []
  const pick = (c) => { onPick(c); setText(''); setActive(0) }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && options[active]) pick(options[active])
    else if (e.key === 'Escape') setText('')
  }
  return (
    <div className="relative">
      <input
        autoFocus
        value={text}
        onChange={(e) => { setText(e.target.value); setActive(0) }}
        onKeyDown={onKeyDown}
        placeholder="Type a club or country…"
        className="w-full border-2 border-ink/20 focus:border-accent outline-none rounded-lg px-4 py-3 bg-white text-ink"
      />
      {options.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-ink/10 rounded-lg shadow-lg max-h-64 overflow-auto">
          {options.map((c, i) => (
            <li
              key={c}
              onMouseDown={(e) => { e.preventDefault(); pick(c) }}
              onMouseEnter={() => setActive(i)}
              className={`px-4 py-2 cursor-pointer flex justify-between ${i === active ? 'bg-accent/10' : ''}`}
            >
              <span className="text-ink">{c}</span>
              <span className="text-ink/40 text-sm">{db.stats[c].country}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Game({ db, answer, initial, onChange, onRestart }) {
  const [guesses, setGuesses] = useState(initial?.guesses ?? [])
  const [gaveUp, setGaveUp] = useState(initial?.gaveUp ?? false)
  const hints = useMemo(() => guesses.map((g) => hint(db, g, answer)), [db, guesses, answer])
  const won = guesses.includes(answer)
  const over = won || gaveUp || guesses.length >= MAX_GUESSES
  const a = db.stats[answer]

  useEffect(() => { onChange?.({ guesses, gaveUp }) }, [guesses, gaveUp, onChange])

  return (
    <>
      <div className="text-sm text-ink/60">{guesses.length}/{MAX_GUESSES} guesses</div>
      {!over && <ClubInput db={db} exclude={guesses} onPick={(c) => setGuesses((g) => [...g, c])} />}

      {over && (
        <div className={`rounded-lg p-4 border-2 ${won ? 'border-green-500 bg-green-50' : 'border-accent bg-accent/5'}`}>
          <div className="font-display text-xl font-semibold text-ink">
            {won ? `🎉 Got it in ${guesses.length}!` : `The answer was ${answer}`}
          </div>
          <div className="text-sm text-ink/60 mb-3">
            {a.country} · {a.seasons} seasons since {fmtSeason(a.debut)} · {a.matches.length} matches · best: {RANK_LABEL[a.best]}
            {a.titles > 0 && ` (${a.titles}×)`}
          </div>
          <details className="text-sm text-ink/80 mb-4">
            <summary className="cursor-pointer text-accent">Latest matches</summary>
            <ul className="mt-2 space-y-1">
              {a.matches.slice(-10).reverse().map((m) => (
                <li key={m.date + m.home}>
                  <span className="text-ink/40">{fmtDate(m.date)} · {STAGES[m.stage][0]}:</span> {fmtMatch(m)}
                </li>
              ))}
            </ul>
          </details>
          {onRestart
            ? <button onClick={onRestart} className="bg-accent text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90">Play again</button>
            : <div className="text-sm text-ink/60">Come back tomorrow for a new club — or try Practice.</div>}
        </div>
      )}

      <div className="space-y-3">
        {[...hints].reverse().map((h) => <HintCard key={h.guess} h={h} correct={h.guess === answer} />)}
      </div>

      {!over && guesses.length > 0 && (
        <button onClick={() => setGaveUp(true)} className="text-sm text-ink/40 hover:text-accent">Give up</button>
      )}
    </>
  )
}

function Daily({ db }) {
  const date = today()
  const key = `ucl-daily-${date}`
  const onChange = useMemo(() => (state) => save(key, state), [key])
  return <Game key={date} db={db} answer={dailyAnswer(db.pool, date)} initial={load(key)} onChange={onChange} />
}

function Practice({ db }) {
  const pick = () => db.pool[Math.floor(Math.random() * db.pool.length)]
  const [answer, setAnswer] = useState(pick)
  const [round, setRound] = useState(0)
  return <Game key={round} db={db} answer={answer} onRestart={() => { setAnswer(pick()); setRound((r) => r + 1) }} />
}

export default function UCLGuesser() {
  const [db, setDb] = useState(null)
  const [mode, setMode] = useState('daily')

  useEffect(() => { import('../data/ucl.json').then((m) => setDb(buildDb(m.default))) }, [])

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-ink/10 bg-canvas px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <a href="#/" className="text-accent hover:underline text-sm font-medium">← Back</a>
          <div className="flex gap-1 bg-white border border-ink/10 rounded-lg p-1 text-sm">
            {[['daily', '📅 Daily'], ['practice', '🎲 Practice']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-md font-medium ${mode === m ? 'bg-accent text-white' : 'text-ink/60 hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">⚽ UCL Club Guesser</h1>
          <p className="mt-1 text-ink/60 text-sm">
            Guess the mystery Champions League club (1992–93 to 2025–26, main tournament).
            ↑/↓ shows whether the answer's value is higher or lower.
            {db && ` ${db.names.length} clubs · ${db.matchCount.toLocaleString()} matches.`}
          </p>
        </div>
        {!db ? <div className="text-ink/40">Loading matches…</div>
          : mode === 'daily' ? <Daily db={db} /> : <Practice db={db} />}
      </main>
    </div>
  )
}
