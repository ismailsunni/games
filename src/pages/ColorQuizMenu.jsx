// Sub-menu for Swatch→Name or Name→Swatch: choose Infinite or 5-Round
export default function ColorQuizMenu({ type }) {
  // type: 'swatch' | 'name'
  const isReverse = type === 'swatch'
  const base      = isReverse ? '#/colorguesser/swatchquiz' : '#/colorguesser/namequiz'
  const title     = isReverse ? '🎨 Swatch → Name' : '🏷️ Name → Swatch'
  const desc      = isReverse
    ? 'See a color swatch, pick the correct name.'
    : 'See a color name, pick the correct swatch.'

  return (
    <div className="min-h-screen bg-paper font-body flex flex-col">
      <header className="border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
        <a href="#/colorguesser" className="text-accent hover:underline text-sm font-medium">← Back</a>
        <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">{title}</h1>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 max-w-md mx-auto w-full gap-6">
        <p className="text-ink/60 text-sm text-center">{desc}</p>

        {/* 5-Round */}
        <a
          href={`${base}/play`}
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🏁</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                5 Questions
              </div>
              <div className="text-sm text-ink/60 mt-1">
                Classic quiz — 5 rounds, scored by speed and accuracy.
              </div>
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">Play →</span>
          </div>
        </a>

        {/* Infinite */}
        <a
          href={`${base}/infinite`}
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
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">Play →</span>
          </div>
        </a>
      </div>
    </div>
  )
}
