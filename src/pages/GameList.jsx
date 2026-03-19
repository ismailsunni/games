const games = [
  {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    description: 'Configurable board size (3×3 to 10×10) and win length. Play against Easy, Medium, or Hard AI.',
    emoji: '⭕',
    hash: '#/tictactoe',
  },
  {
    id: 'tictactwo',
    name: 'Tic-Tac-Two',
    description: 'Play the game you win. 2×2 board, 2 in a row. Simple as that.',
    emoji: '✌️',
    hash: '#/tictactwo',
  },
  {
    id: 'tictactoe3d',
    name: 'Tic-Tac-Three-D',
    description: 'Classic Tic-Tac-Toe across three layers. Get 3 in a row in any direction — 49 winning lines total.',
    emoji: '🧊',
    hash: '#/tictactoe3d',
  },
  {
    id: 'ginrummy',
    name: 'Gin Rummy',
    description: 'Classic card game. Draw, discard, form sets and runs. Knock when deadwood ≤ 10. First to 100 wins.',
    emoji: '🃏',
    hash: '#/ginrummy',
  },
  {
    id: 'mapguesser',
    name: 'Map Guesser',
    description: 'Zoom in on a mystery city. Guess where it is on the world map. Score based on distance.',
    emoji: '🗺️',
    hash: '#/mapguesser',
  },
  {
    id: 'colorguesser',
    name: 'Color Guesser',
    description: 'Test your color sense. Guess RGB values from a swatch, or match color names to swatches.',
    emoji: '🎨',
    hash: '#/colorguesser',
  },
]

const shuffled = [...games].sort(() => Math.random() - 0.5)

export default function GameList() {
  return (
    <div className="min-h-screen bg-paper font-body">
      {/* Header */}
      <header className="border-b border-ink/10 bg-canvas px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-ink leading-tight">
            🎮 Games
          </h1>
          <p className="mt-2 text-ink/60 text-lg">A collection of games by Ismail</p>
        </div>
      </header>

      {/* Game grid */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shuffled.map((game) => (
            <a
              key={game.id}
              href={game.hash}
              className="group block bg-white border border-ink/10 rounded-lg overflow-hidden hover:border-accent hover:shadow-md transition-all duration-200"
            >
              <div className="bg-canvas px-6 py-8 text-center text-5xl">
                {game.emoji}
              </div>
              <div className="p-5">
                <h2 className="font-display text-xl font-semibold text-ink mb-1">
                  {game.name}
                </h2>
                <p className="text-ink/60 text-sm leading-relaxed mb-4">
                  {game.description}
                </p>
                <span className="text-accent font-medium text-sm group-hover:underline">
                  Play →
                </span>
              </div>
            </a>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-ink/10 px-6 py-6 text-center text-ink/40 text-sm">
        ismailsunni.id/games
      </footer>
    </div>
  )
}
