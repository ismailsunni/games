import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'

const games = [
  {
    id: 'semantika',
    name: 'Semantika',
    description: 'Guess the secret Indonesian word by meaning. Each guess shows how semantically close it is. Daily and practice modes.',
    emoji: '🧠',
    hash: '#/semantika',
    category: 'Word',
    tile: 'from-violet-400 to-purple-700',
    badge: 'New',
    featured: true,
  },
  {
    id: 'katatigadua',
    name: 'KataTigaDua',
    description: 'Wordle ×32 in Bahasa Indonesia. Solve 32 five-letter words at once with 37 guesses. Daily and practice modes.',
    emoji: '🇮🇩',
    hash: '#/katatigadua',
    category: 'Word',
    tile: 'from-red-400 to-rose-600',
    featured: true,
  },
  {
    id: 'uclguesser',
    name: 'UCL Club Guesser',
    description: 'Guess the mystery Champions League club (1992–2026). Each guess reveals head-to-head record (W/D/L), titles, debut and more.',
    emoji: '⚽',
    hash: '#/uclguesser',
    category: 'Sports',
    tile: 'from-sky-400 to-indigo-600',
    badge: 'Daily',
    featured: true,
  },
  {
    id: 'tspreal',
    name: 'TSP Cities',
    description: 'Find the shortest route through real city streets. Choose Ljubljana or München. Real road distances via pgRouting.',
    emoji: '🏙️',
    hash: '#/tspreal',
    category: 'Geography',
    tile: 'from-amber-300 to-orange-500',
    featured: true,
  },
  {
    id: 'tspgame',
    name: 'TSP Game',
    description: 'Find the shortest route visiting all cities and returning home. Beat the optimal solution!',
    emoji: '🗺️',
    hash: '#/tspgame',
    category: 'Puzzle',
    tile: 'from-lime-300 to-emerald-500',
    featured: true,
  },
  {
    id: 'mapguesser',
    name: 'Map Guesser',
    description: 'Zoom in on a mystery city. Guess where it is on the world map. Score based on distance.',
    emoji: '🌍',
    hash: '#/mapguesser',
    category: 'Geography',
    tile: 'from-teal-300 to-cyan-600',
    featured: true,
  },
  {
    id: 'ginrummy',
    name: 'Gin Rummy',
    description: 'Classic card game. Draw, discard, form sets and runs. Knock when deadwood ≤ 10. First to 100 wins.',
    emoji: '🃏',
    hash: '#/ginrummy',
    category: 'Cards',
    tile: 'from-rose-400 to-red-600',
    featured: true,
  },
  {
    id: 'colorguesser',
    name: 'Color Guesser',
    description: 'Test your color sense. Guess RGB values from a swatch, or match color names to swatches.',
    emoji: '🎨',
    hash: '#/colorguesser',
    category: 'Color',
    tile: 'from-fuchsia-400 to-violet-600',
  },
  {
    id: 'arithmetic',
    name: 'Arithmetic Rush',
    description: '8 levels of timed arithmetic — add, subtract, multiply, divide. 5-question and infinite streak modes.',
    emoji: '🔢',
    hash: '#/arithmetic',
    category: 'Math',
    tile: 'from-yellow-300 to-amber-500',
  },
  {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    description: 'Configurable board size (3×3 to 10×10) and win length. Play against Easy, Medium, or Hard AI.',
    emoji: '⭕',
    hash: '#/tictactoe',
    category: 'Puzzle',
    tile: 'from-slate-300 to-slate-500',
  },
  {
    id: 'tictactwo',
    name: 'Tic-Tac-Two',
    description: 'Play the game you win. 2×2 board, 2 in a row. Simple as that.',
    emoji: '✌️',
    hash: '#/tictactwo',
    category: 'Puzzle',
    tile: 'from-pink-300 to-rose-500',
  },
  {
    id: 'tictactoe3d',
    name: 'Tic-Tac-Three-D',
    description: 'Classic Tic-Tac-Toe across three layers. Get 3 in a row in any direction — 49 winning lines total.',
    emoji: '🧊',
    hash: '#/tictactoe3d',
    category: 'Puzzle',
    tile: 'from-cyan-300 to-blue-500',
  },
]

const categories = ['All', ...new Set(games.map((g) => g.category))]

function GameCard({ game, large }) {
  return (
    <a
      href={game.hash}
      className="group flex flex-row sm:flex-col bg-white border border-ink/10 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-ink/20 transition-all duration-200"
    >
      <div className={`relative shrink-0 w-24 sm:w-auto bg-gradient-to-br ${game.tile} ${large ? 'sm:h-36' : 'sm:h-28'} flex items-center justify-center`}>
        <span className={`text-4xl ${large ? 'sm:text-6xl' : 'sm:text-5xl'} drop-shadow-md transition-transform duration-200 group-hover:scale-110`}>
          {game.emoji}
        </span>
        {game.badge && (
          <span className="absolute top-2 left-2 sm:left-auto sm:top-3 sm:right-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-ink shadow-sm">
            {game.badge}
          </span>
        )}
      </div>
      <div className="flex flex-col flex-1 min-w-0 p-4 sm:p-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink/40 mb-1">{game.category}</div>
        <h2 className="font-display text-lg sm:text-xl font-bold text-ink mb-1">{game.name}</h2>
        <p className="text-ink/60 text-sm leading-relaxed flex-1 line-clamp-2 sm:line-clamp-none">{game.description}</p>
        <span className="hidden sm:inline-flex mt-4 items-center gap-1 text-accent font-semibold text-sm">
          Play <span className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      </div>
    </a>
  )
}

export default function GameList() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [dark, toggleTheme] = useTheme()

  const q = query.trim().toLowerCase()
  const filtered = games.filter(
    (g) =>
      (category === 'All' || g.category === category) &&
      (!q || `${g.name} ${g.description} ${g.category}`.toLowerCase().includes(q)),
  )
  const browsing = q || category !== 'All'
  const featured = filtered.filter((g) => g.featured)
  const others = filtered.filter((g) => !g.featured)

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="relative overflow-hidden border-b border-ink/10 bg-canvas">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <button
            onClick={toggleTheme}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="absolute top-4 right-4 sm:right-6 h-10 w-10 rounded-full border border-ink/10 bg-surface/70 text-lg shadow-sm hover:border-ink/30"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <h1 className="font-display text-5xl sm:text-6xl font-extrabold text-ink leading-none">
            🌍 Orb<span className="text-accent">IS</span>
          </h1>
          <p className="mt-3 text-ink/60 text-lg">Play the world. {games.length} small games, no sign-up.</p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games…"
              className="w-full sm:max-w-xs rounded-full border border-ink/15 bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink/40 shadow-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium border ${
                    category === c
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white/70 text-ink/70 border-ink/10 hover:border-ink/30'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-12">
        {filtered.length === 0 && (
          <p className="text-center text-ink/50 py-16">No games match “{query}”.</p>
        )}

        {!browsing && featured.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-accent mb-4">⭐ Featured</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {featured.map((g) => <GameCard key={g.id} game={g} large />)}
            </div>
          </section>
        )}

        {(browsing ? filtered : others).length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink/40 mb-4">
              {browsing ? `${filtered.length} game${filtered.length === 1 ? '' : 's'}` : 'More games'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {(browsing ? filtered : others).map((g) => <GameCard key={g.id} game={g} />)}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-ink/10 px-6 py-8 text-center text-ink/40 text-sm">
        OrbIS · Play the world · by{' '}
        <a href="https://github.com/ismailsunni" className="hover:text-accent">ismailsunni</a>
      </footer>
    </div>
  )
}
