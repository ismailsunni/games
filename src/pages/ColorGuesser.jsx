import { colors } from '../data/colors'

function loadRGBStats() {
  try {
    const s = localStorage.getItem('colorguesser_rgb_stats')
    return s ? { gamesPlayed: 0, bestTotal: null, ...JSON.parse(s) } : { gamesPlayed: 0, bestTotal: null }
  } catch { return { gamesPlayed: 0, bestTotal: null } }
}

export default function ColorGuesser() {
  const rgbStats = loadRGBStats()

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

        {/* RGB Guesser */}
        <a href="#/colorguesser/rgb"
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🌈</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                RGB Guesser
              </div>
              <div className="text-sm text-ink/60 mt-1">
                See a color swatch, guess the R G B values.
              </div>
              {rgbStats.gamesPlayed > 0
                ? <div className="text-xs text-ink/40 mt-2">{rgbStats.gamesPlayed} games · best {rgbStats.bestTotal} dist</div>
                : <div className="text-xs text-ink/30 mt-2">Not played yet</div>}
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">Play →</span>
          </div>
        </a>

        {/* Swatch → Name */}
        <a href="#/colorguesser/swatchquiz"
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🎨</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                Swatch → Name
              </div>
              <div className="text-sm text-ink/60 mt-1">
                See a color swatch, pick the correct name.
              </div>
              <div className="text-xs text-ink/30 mt-2">5 rounds · Infinite mode inside</div>
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">Play →</span>
          </div>
        </a>

        {/* Name → Swatch */}
        <a href="#/colorguesser/namequiz"
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🏷️</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                Name → Swatch
              </div>
              <div className="text-sm text-ink/60 mt-1">
                See a color name, pick the correct swatch.
              </div>
              <div className="text-xs text-ink/30 mt-2">5 rounds · Infinite mode inside</div>
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">Play →</span>
          </div>
        </a>
      </div>
    </div>
  )
}
