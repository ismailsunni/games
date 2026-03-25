import { colors } from '../data/colors'

const DEFAULT_RGB_STATS = { gamesPlayed: 0, bestTotal: null, totalDistance: 0 }
const DEFAULT_QUIZ_STATS = { gamesPlayed: 0, bestScore: 0, totalScore: 0 }
const DEFAULT_INF_STATS  = { gamesPlayed: 0, bestStreak: 0 }

function loadRGBStats() {
  try {
    const s = localStorage.getItem('colorguesser_rgb_stats')
    return s ? { ...DEFAULT_RGB_STATS, ...JSON.parse(s) } : { ...DEFAULT_RGB_STATS }
  } catch {
    return { ...DEFAULT_RGB_STATS }
  }
}

function loadQuizStats() {
  try {
    const s = localStorage.getItem('colorguesser_namequiz_stats')
    return s ? { ...DEFAULT_QUIZ_STATS, ...JSON.parse(s) } : { ...DEFAULT_QUIZ_STATS }
  } catch {
    return { ...DEFAULT_QUIZ_STATS }
  }
}

function loadInfStats() {
  try {
    const s = localStorage.getItem('colorguesser_infinite_stats')
    return s ? { ...DEFAULT_INF_STATS, ...JSON.parse(s) } : { ...DEFAULT_INF_STATS }
  } catch { return { ...DEFAULT_INF_STATS } }
}

export default function ColorGuesser() {
  const rgbStats  = loadRGBStats()
  const quizStats = loadQuizStats()
  const infStats  = loadInfStats()

  return (
    <div className="min-h-screen bg-paper font-body flex flex-col">
      <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
        <a href="#/" className="text-accent hover:underline text-sm font-medium">← Back</a>
        <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">🎨 Color Guesser</h1>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 max-w-md mx-auto w-full gap-6">
        <p className="text-ink/60 text-sm text-center">
          Test your color sense — {colors.length} named colors
        </p>

        {/* RGB Guesser card */}
        <a
          href="#/colorguesser/rgb"
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🌈</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                RGB Guesser
              </div>
              <div className="text-sm text-ink/60 mt-1">
                See a color swatch, guess the R G B values. Lower total distance = better.
              </div>
              {rgbStats.gamesPlayed > 0 ? (
                <div className="text-xs text-ink/40 mt-2">
                  {rgbStats.gamesPlayed} {rgbStats.gamesPlayed === 1 ? 'game' : 'games'} ·{' '}
                  best {rgbStats.bestTotal} dist
                </div>
              ) : (
                <div className="text-xs text-ink/30 mt-2">Not played yet</div>
              )}
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">
              Play →
            </span>
          </div>
        </a>

        {/* Swatch → Name card */}
        <a
          href="#/colorguesser/swatchquiz"
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🎨</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                Swatch → Name
              </div>
              <div className="text-sm text-ink/60 mt-1">
                See a color swatch, pick the correct name from 4 options.
              </div>
              <div className="text-xs text-ink/30 mt-2">5 rounds</div>
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">Play →</span>
          </div>
        </a>

        {/* Swatch → Name Infinite card */}
        <a
          href="#/colorguesser/swatchquiz/infinite"
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🎨♾️</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                Swatch → Name ∞
              </div>
              <div className="text-sm text-ink/60 mt-1">
                Swatch-to-name in infinite mode. One mistake ends it.
              </div>
              <div className="text-xs text-ink/30 mt-2">Best streak: {infStats.bestStreak || '—'}</div>
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">Play →</span>
          </div>
        </a>

        {/* Name → Swatch Infinite card */}
        <a
          href="#/colorguesser/namequiz/infinite"
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">♾️</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                Infinite Mode
              </div>
              <div className="text-sm text-ink/60 mt-1">
                One wrong answer and it's over. How long can you streak?
              </div>
              {infStats.gamesPlayed > 0 ? (
                <div className="text-xs text-ink/40 mt-2">
                  {infStats.gamesPlayed} {infStats.gamesPlayed === 1 ? 'game' : 'games'} ·{' '}
                  best streak {infStats.bestStreak}
                </div>
              ) : (
                <div className="text-xs text-ink/30 mt-2">Not played yet</div>
              )}
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">
              Play →
            </span>
          </div>
        </a>

        {/* Color Name Quiz card */}
        <a
          href="#/colorguesser/namequiz"
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🏷️</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                Color Name Quiz
              </div>
              <div className="text-sm text-ink/60 mt-1">
                Given a color name, pick the correct swatch from 4 options.
              </div>
              {quizStats.gamesPlayed > 0 ? (
                <div className="text-xs text-ink/40 mt-2">
                  {quizStats.gamesPlayed} {quizStats.gamesPlayed === 1 ? 'game' : 'games'} ·{' '}
                  best {quizStats.bestScore.toLocaleString()} / 25,000
                </div>
              ) : (
                <div className="text-xs text-ink/30 mt-2">Not played yet</div>
              )}
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">
              Play →
            </span>
          </div>
        </a>
      </div>
    </div>
  )
}
